'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'

const contactSchema = z.object({
  name: z.string().min(2, 'nameMin'),
  email: z.string().email('emailInvalid'),
  phone: z.string().optional(),
  message: z.string().min(10, 'messageMin'),
  terms: z.boolean().refine((v) => v === true, 'termsRequired'),
})

type ContactFormData = z.infer<typeof contactSchema>

export function ContactForm() {
  const t = useTranslations('support')
  const tAuth = useTranslations('auth')
  const tErrors = useTranslations('errors')
  const locale = useLocale()
  const isArabic = locale === 'ar'
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    defaultValues: { name: '', email: '', phone: '', message: '', terms: false },
  })

  const termsValue = watch('terms')

  async function onSubmit(data: ContactFormData) {
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000))
    toast.success(t('messageSent'))
    reset()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
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

      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? t('submitButton') + '…' : t('submitButton')}
      </Button>
    </form>
  )
}
