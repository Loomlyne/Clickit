'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'

import { submitSupportMessage } from '@/app/actions/contact'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  TurnstileField,
  useTurnstileToken,
} from '@/components/security/turnstile-field'
import { isCaptchaFailure } from '@/lib/turnstile-widget'

const contactSchema = z.object({
  name: z.string().min(2, 'nameMin'),
  email: z.string().email('emailInvalid'),
  phone: z.string().optional(),
  subject: z.string().min(3, 'fieldRequired'),
  message: z.string().min(10, 'messageMin'),
  terms: z.boolean().refine((v) => v === true, 'termsRequired'),
})

type ContactFormData = z.infer<typeof contactSchema>

export function ContactForm() {
  const t = useTranslations('support')
  const tErrors = useTranslations('errors')
  const [submitState, setSubmitState] = useState<'idle' | 'saved_email_failed'>(
    'idle'
  )
  // Turnstile (PLAT-05): single-use token, submit disabled until one exists.
  const captcha = useTurnstileToken()
  const { needsToken, awaitingToken } = captcha
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      subject: '',
      message: '',
      terms: false,
    },
  })

  const termsValue = watch('terms')

  async function onSubmit(data: ContactFormData) {
    if (awaitingToken) return
    captcha.setFailed(false)
    const result = await submitSupportMessage(data, captcha.token ?? undefined)
    // The token is single-use: whatever the outcome, a fresh one is needed.
    const refused = !result.ok && isCaptchaFailure(result.message)
    captcha.consume(refused)

    if (!result.ok) {
      if (result.code === 'validation' && result.fieldErrors) {
        for (const [field, messages] of Object.entries(result.fieldErrors)) {
          const message = messages?.[0]
          if (!message) continue
          setError(field as keyof ContactFormData, { message })
        }
        return
      }

      // With the widget drawn, a captcha refusal shows under it (signed).
      if (!(needsToken && refused)) {
        toast.error(result.message || tErrors('networkError'))
      }
      return
    }

    if (result.status === 'saved_email_failed') {
      setSubmitState('saved_email_failed')
      toast.success(t('savedEmailFailedToast'))
      reset({
        name: '',
        email: '',
        phone: '',
        subject: '',
        message: '',
        terms: false,
      })
      return
    }

    setSubmitState('idle')
    toast.success(t('messageSent'))
    reset({
      name: '',
      email: '',
      phone: '',
      subject: '',
      message: '',
      terms: false,
    })
  }

  return (
    <form
      id="contact-form"
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-5"
    >
      <div>
        <Label htmlFor="name">{t('nameLabel')}</Label>
        <Input
          id="name"
          placeholder={t('namePlaceholder')}
          className="mt-1.5"
          {...register('name')}
        />
        {errors.name && (
          <p className="text-brand-red-safe mt-1 text-xs">
            {tErrors(errors.name.message as never)}
          </p>
        )}
      </div>

      <div>
        <Label htmlFor="email">{t('emailLabel')}</Label>
        <Input
          id="email"
          type="email"
          placeholder={t('emailPlaceholder')}
          className="mt-1.5"
          {...register('email')}
        />
        {errors.email && (
          <p className="text-brand-red-safe mt-1 text-xs">
            {tErrors(errors.email.message as never)}
          </p>
        )}
      </div>

      <div>
        <Label htmlFor="phone">{t('phoneOptional')}</Label>
        <Input
          id="phone"
          type="tel"
          placeholder={t('phonePlaceholder')}
          className="mt-1.5"
          {...register('phone')}
        />
      </div>

      <div>
        <Label htmlFor="subject">{t('subjectLabel')}</Label>
        <Input
          id="subject"
          placeholder={t('subjectPlaceholder')}
          className="mt-1.5 rounded-[10px]"
          {...register('subject')}
        />
        {errors.subject && (
          <p className="text-brand-red-safe mt-1 text-xs">
            {tErrors(errors.subject.message as never)}
          </p>
        )}
      </div>

      <div>
        <Label htmlFor="message">{t('messageLabel')}</Label>
        <Textarea
          id="message"
          placeholder={t('messagePlaceholder')}
          rows={5}
          className="mt-1.5 rounded-[10px]"
          {...register('message')}
        />
        {errors.message && (
          <p className="text-brand-red-safe mt-1 text-xs">
            {tErrors(errors.message.message as never)}
          </p>
        )}
      </div>

      <div className="flex items-start justify-start gap-2">
        <Checkbox
          id="terms"
          className="size-[23px]"
          checked={termsValue}
          onCheckedChange={(checked) => setValue('terms', checked === true)}
        />
        <Label
          htmlFor="terms"
          className="text-muted-foreground text-sm leading-relaxed"
        >
          {t('termsAccept')}
        </Label>
      </div>
      {errors.terms && (
        <p className="text-brand-red-safe text-xs">
          {tErrors(errors.terms.message as never)}
        </p>
      )}

      {submitState === 'saved_email_failed' && (
        <p className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
          {t('savedEmailFailedInline')}
        </p>
      )}

      <TurnstileField
        key={captcha.widgetKey}
        form="contact"
        onToken={captcha.setToken}
        failed={captcha.failed}
      />

      <Button
        type="submit"
        disabled={isSubmitting || awaitingToken}
        className="w-full"
      >
        {isSubmitting ? t('submitButton') + '…' : t('submitButton')}
      </Button>
    </form>
  )
}
