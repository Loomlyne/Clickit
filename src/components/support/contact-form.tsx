'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
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
  const locale = useLocale()
  const isArabic = locale === 'ar'
  const [submitState, setSubmitState] = useState<'idle' | 'saved_email_failed'>('idle')
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
    defaultValues: { name: '', email: '', phone: '', subject: '', message: '', terms: false },
  })

  const termsValue = watch('terms')

  async function onSubmit(data: ContactFormData) {
    const result = await submitSupportMessage(data)

    if (!result.ok) {
      if (result.code === 'validation' && result.fieldErrors) {
        for (const [field, messages] of Object.entries(result.fieldErrors)) {
          const message = messages?.[0]
          if (!message) continue
          setError(field as keyof ContactFormData, { message })
        }
        return
      }

      toast.error(result.message || tErrors('networkError'))
      return
    }

    if (result.status === 'saved_email_failed') {
      setSubmitState('saved_email_failed')
      toast.success(
        isArabic
          ? 'تم حفظ رسالتك، لكن البريد غير مفعّل حالياً. سنراجعها من لوحة الإدارة.'
          : 'Your message was saved, but email delivery is offline right now. The team can still review it in admin.'
      )
      reset({ name: '', email: '', phone: '', subject: '', message: '', terms: false })
      return
    }

    setSubmitState('idle')
    toast.success(t('messageSent'))
    reset({ name: '', email: '', phone: '', subject: '', message: '', terms: false })
  }

  return (
    <form id="contact-form" onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div>
        <Label htmlFor="name">{t('nameLabel')}</Label>
        <Input id="name" placeholder={t('namePlaceholder')} className="mt-1.5" {...register('name')} />
        {errors.name && <p className="mt-1 text-xs text-brand-red-safe">{tErrors(errors.name.message as never)}</p>}
      </div>

      <div>
        <Label htmlFor="email">{t('emailLabel')}</Label>
        <Input id="email" type="email" placeholder={t('emailPlaceholder')} className="mt-1.5" {...register('email')} />
        {errors.email && <p className="mt-1 text-xs text-brand-red-safe">{tErrors(errors.email.message as never)}</p>}
      </div>

      <div>
        <Label htmlFor="phone">{isArabic ? 'الهاتف (اختياري)' : 'Phone (optional)'}</Label>
        <Input id="phone" type="tel" placeholder="+971 XX XXX XXXX" className="mt-1.5" {...register('phone')} />
      </div>

      <div>
        <Label htmlFor="subject">{t('subjectLabel')}</Label>
        <Input id="subject" placeholder={t('subjectPlaceholder')} className="mt-1.5" {...register('subject')} />
        {errors.subject && <p className="mt-1 text-xs text-brand-red-safe">{tErrors(errors.subject.message as never)}</p>}
      </div>

      <div>
        <Label htmlFor="message">{t('messageLabel')}</Label>
        <Textarea id="message" placeholder={t('messagePlaceholder')} rows={5} className="mt-1.5" {...register('message')} />
        {errors.message && <p className="mt-1 text-xs text-brand-red-safe">{tErrors(errors.message.message as never)}</p>}
      </div>

      <div className="flex items-start gap-2">
        <Checkbox
          id="terms"
          checked={termsValue}
          onCheckedChange={(checked) => setValue('terms', checked === true)}
        />
        <Label htmlFor="terms" className="text-sm text-muted-foreground leading-relaxed">
          {t('termsAccept')}
        </Label>
      </div>
      {errors.terms && <p className="text-xs text-brand-red-safe">{tErrors(errors.terms.message as never)}</p>}

      {submitState === 'saved_email_failed' && (
        <p className="rounded-[8px] border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
          {isArabic
            ? 'تم حفظ الرسالة. التنبيه عبر البريد غير مفعّل حالياً.'
            : 'Your message is saved. Email notification is offline right now.'}
        </p>
      )}

      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? t('submitButton') + '…' : t('submitButton')}
      </Button>
    </form>
  )
}
