'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { AlertCircle, Eye, EyeOff } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { mapAuthError } from '@/lib/auth-errors'
import { signUpAction } from '@/app/[locale]/(viewer)/auth/actions'

const signupSchema = z.object({
  name: z.string().min(2, 'nameMin'),
  email: z.string().email('emailInvalid'),
  password: z.string().min(6, 'passwordMin'),
  confirmPassword: z.string(),
  terms: z.boolean().refine((v) => v === true, 'termsRequired'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'passwordMismatch',
  path: ['confirmPassword'],
})

type SignupFormData = z.infer<typeof signupSchema>

export function SignupForm() {
  const t = useTranslations('auth')
  const tErrors = useTranslations('errors')
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: { name: '', email: '', password: '', confirmPassword: '', terms: false },
  })

  const termsValue = watch('terms')
  const passwordValue = watch('password') ?? ''
  const passwordScore = [
    passwordValue.length >= 8,
    /[A-Z]/.test(passwordValue),
    /[0-9]/.test(passwordValue),
    /[^A-Za-z0-9]/.test(passwordValue),
  ].filter(Boolean).length

  async function onSubmit(data: SignupFormData) {
    setServerError(null)

    // BotID-gated Server Action. On success we still call the browser-side
    // supabase client to sync the session cookie locally; see login-form.tsx
    // comment for the rationale.
    const result = await signUpAction(data.email, data.password, data.name)

    if (!result.ok) {
      setServerError(mapAuthError(result.error))
      return
    }

    const supabase = createClient()
    await supabase.auth.signInWithPassword({ email: data.email, password: data.password })

    toast.success(t('accountCreated'))
    router.push('/browse')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 md:space-y-4">
      {serverError && (
        <div className="rounded-[14px] px-4 py-3 text-sm bg-[#DB3F34]/10 border border-[#DB3F34]/25 text-red-300">
          <div className="flex gap-2.5 items-start">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{serverError}</span>
          </div>
        </div>
      )}

      <div>
        <Label htmlFor="signup-name">{t('displayName')}</Label>
        <Input id="signup-name" placeholder={t('displayNamePlaceholder')} className="mt-1.5" {...register('name')} />
        {errors.name && <p className="mt-1 text-xs text-brand-red-safe">{tErrors(errors.name.message as never)}</p>}
      </div>

      <div>
        <Label htmlFor="signup-email">{t('email')}</Label>
        <Input id="signup-email" type="email" placeholder={t('emailPlaceholder')} className="mt-1.5" {...register('email')} />
        {errors.email && <p className="mt-1 text-xs text-brand-red-safe">{tErrors(errors.email.message as never)}</p>}
      </div>

      <div>
        <Label htmlFor="signup-password">{t('password')}</Label>
        <div className="relative mt-1.5">
          <Input
            id="signup-password"
            type={showPassword ? 'text' : 'password'}
            placeholder="••••••••"
            className="pe-10"
            {...register('password')}
          />
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowPassword(!showPassword)}
            aria-label={showPassword ? t('hidePassword') : t('showPassword')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors"
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        <div className="mt-2 grid grid-cols-4 gap-1.5" aria-label="Password strength">
          {[1, 2, 3, 4].map((level) => (
            <span
              key={level}
              className={`h-1 rounded-[14px] ${passwordScore >= level ? 'bg-[var(--primary)]' : 'bg-[var(--bg-3)]'}`}
            />
          ))}
        </div>
        <p className="mono mt-1.5 text-[10px] text-[var(--text-mute)]">
          Strength · {passwordScore < 2 ? 'weak' : passwordScore < 4 ? 'good' : 'strong'}
        </p>
        {errors.password && <p className="mt-1 text-xs text-brand-red-safe">{tErrors(errors.password.message as never)}</p>}
      </div>

      <div>
        <Label htmlFor="signup-confirm">{t('confirmPassword')}</Label>
        <div className="relative mt-1.5">
          <Input
            id="signup-confirm"
            type={showConfirm ? 'text' : 'password'}
            placeholder="••••••••"
            className="pe-10"
            {...register('confirmPassword')}
          />
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowConfirm(!showConfirm)}
            aria-label={showConfirm ? t('hidePassword') : t('showPassword')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors"
          >
            {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        {errors.confirmPassword && <p className="mt-1 text-xs text-brand-red-safe">{tErrors(errors.confirmPassword.message as never)}</p>}
      </div>

      <div className="flex items-start gap-2">
        <Checkbox
          id="signup-terms"
          checked={termsValue}
          onCheckedChange={(checked) => setValue('terms', checked === true)}
        />
        <Label htmlFor="signup-terms" className="text-sm text-muted-foreground leading-relaxed">
          {t('termsAccept')}
        </Label>
      </div>
      {errors.terms && <p className="text-xs text-brand-red-safe">{tErrors(errors.terms.message as never)}</p>}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-[14px] bg-primary px-7 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-[#7082ff] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSubmitting ? t('signUpButton') + '…' : t('signUpButton')}
      </button>
    </form>
  )
}
