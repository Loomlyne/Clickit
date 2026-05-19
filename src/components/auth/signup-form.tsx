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
import { mapAuthError } from '@/lib/auth-errors'
import { signUpAction } from '@/app/[locale]/(viewer)/auth/actions'

const signupSchema = z
  .object({
    name: z.string().min(2, 'nameMin'),
    email: z.string().email('emailInvalid'),
    password: z.string().min(6, 'passwordMin'),
    confirmPassword: z.string(),
    terms: z.boolean().refine((v) => v === true, 'termsRequired'),
  })
  .refine((data) => data.password === data.confirmPassword, {
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
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
      terms: false,
    },
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

    // BotID-gated Server Action sets the auth cookies server-side.
    const result = await signUpAction(data.email, data.password, data.name)

    if (!result.ok) {
      setServerError(mapAuthError(result.error))
      return
    }

    toast.success(t('accountCreated'))
    router.replace('/watch')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 md:space-y-4">
      {serverError && (
        <div className="rounded-full border border-[#DB3F34]/25 bg-[#DB3F34]/10 px-4 py-3 text-sm text-red-300">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{serverError}</span>
          </div>
        </div>
      )}

      <div>
        <Label htmlFor="signup-name">{t('displayName')}</Label>
        <Input
          id="signup-name"
          placeholder={t('displayNamePlaceholder')}
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
        <Label htmlFor="signup-email">{t('email')}</Label>
        <Input
          id="signup-email"
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
            className="absolute top-1/2 right-3 -translate-y-1/2 text-white/40 transition-colors hover:text-white/70"
          >
            {showPassword ? (
              <EyeOff className="size-4" />
            ) : (
              <Eye className="size-4" />
            )}
          </button>
        </div>
        <div
          className="mt-2 grid grid-cols-4 gap-1.5"
          aria-label={t('passwordStrengthAria')}
        >
          {[1, 2, 3, 4].map((level) => (
            <span
              key={level}
              className={`h-1 rounded-full ${passwordScore >= level ? 'bg-[var(--primary)]' : 'bg-[var(--bg-3)]'}`}
            />
          ))}
        </div>
        <p className="mono mt-1.5 text-[10px] text-[var(--text-mute)]">
          {t('strengthLabel', {
            level:
              passwordScore < 2
                ? t('strengthWeak')
                : passwordScore < 4
                  ? t('strengthGood')
                  : t('strengthStrong'),
          })}
        </p>
        {errors.password && (
          <p className="text-brand-red-safe mt-1 text-xs">
            {tErrors(errors.password.message as never)}
          </p>
        )}
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
            className="absolute top-1/2 right-3 -translate-y-1/2 text-white/40 transition-colors hover:text-white/70"
          >
            {showConfirm ? (
              <EyeOff className="size-4" />
            ) : (
              <Eye className="size-4" />
            )}
          </button>
        </div>
        {errors.confirmPassword && (
          <p className="text-brand-red-safe mt-1 text-xs">
            {tErrors(errors.confirmPassword.message as never)}
          </p>
        )}
      </div>

      <div className="flex items-start gap-2">
        <Checkbox
          id="signup-terms"
          checked={termsValue}
          onCheckedChange={(checked) => setValue('terms', checked === true)}
        />
        <Label
          htmlFor="signup-terms"
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

      <button
        type="submit"
        disabled={isSubmitting}
        className="bg-primary text-primary-foreground w-full rounded-full px-7 py-3 text-sm font-semibold transition-colors hover:bg-[#7082ff] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSubmitting ? t('signUpButton') + '…' : t('signUpButton')}
      </button>
    </form>
  )
}
