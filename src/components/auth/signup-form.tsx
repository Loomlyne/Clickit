'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Link, useRouter } from '@/i18n/navigation'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { mapAuthError } from '@/lib/auth-errors'
import { signUpAction } from '@/app/[locale]/(viewer)/auth/actions'
import { AuthAlert } from './auth-alert'
import { PasswordField } from './password-field'
import { NAME_MIN, PASSWORD_MIN, errorParams } from './password-rules'

const signupSchema = z
  .object({
    name: z.string().min(NAME_MIN, 'nameMin'),
    email: z.string().email('emailInvalid'),
    password: z.string().min(PASSWORD_MIN, 'passwordMin'),
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

  const {
    register,
    handleSubmit,
    setValue,
    control,
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

  const termsValue = useWatch({ control, name: 'terms' })
  const passwordValue = useWatch({ control, name: 'password' }) ?? ''
  const fieldError = (key?: string) =>
    key ? tErrors(key as never, errorParams(key) as never) : undefined

  async function onSubmit(data: SignupFormData) {
    setServerError(null)

    // BotID-gated Server Action sets the auth cookies server-side.
    const result = await signUpAction(data.email, data.password, data.name)

    if (!result.ok) {
      setServerError(
        result.error === 'passwordMin'
          ? fieldError('passwordMin')!
          : mapAuthError(result.error)
      )
      return
    }

    toast.success(t('accountCreated'))
    router.replace('/watch')
    router.refresh()
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col gap-4"
      method="post"
      noValidate
    >
      {serverError && <AuthAlert variant="error">{serverError}</AuthAlert>}

      <div>
        <Label htmlFor="signup-name">{t('displayName')}</Label>
        <Input
          id="signup-name"
          autoComplete="name"
          placeholder={t('displayNamePlaceholder')}
          className="mt-1.5"
          aria-invalid={errors.name ? true : undefined}
          {...register('name')}
        />
        {errors.name && (
          <p className="mt-1 text-[13px] text-[var(--color-brand-red-safe)]">
            {fieldError(errors.name.message)}
          </p>
        )}
      </div>

      <div>
        <Label htmlFor="signup-email">{t('email')}</Label>
        <Input
          id="signup-email"
          type="email"
          autoComplete="email"
          placeholder={t('emailPlaceholder')}
          className="mt-1.5"
          aria-invalid={errors.email ? true : undefined}
          {...register('email')}
        />
        {errors.email && (
          <p className="mt-1 text-[13px] text-[var(--color-brand-red-safe)]">
            {fieldError(errors.email.message)}
          </p>
        )}
      </div>

      <PasswordField
        id="signup-password"
        label={t('password')}
        autoComplete="new-password"
        placeholder="••••••••"
        strengthOf={passwordValue}
        error={fieldError(errors.password?.message)}
        {...register('password')}
      />

      <PasswordField
        id="signup-confirm"
        label={t('confirmPassword')}
        autoComplete="new-password"
        placeholder="••••••••"
        error={fieldError(errors.confirmPassword?.message)}
        {...register('confirmPassword')}
      />

      <div>
        <div className="flex min-h-11 items-center gap-3">
          <Checkbox
            id="signup-terms"
            checked={termsValue}
            onCheckedChange={(checked) =>
              setValue('terms', checked === true, { shouldValidate: true })
            }
          />
          <Label
            htmlFor="signup-terms"
            className="block text-sm leading-normal font-normal text-[var(--text-dim)]"
          >
            {t.rich('termsAccept', {
              terms: (chunks) => (
                <Link
                  href="/terms"
                  target="_blank"
                  rel="noopener"
                  className="text-[var(--text)] underline underline-offset-[3px]"
                >
                  {chunks}
                </Link>
              ),
              privacy: (chunks) => (
                <Link
                  href="/privacy"
                  target="_blank"
                  rel="noopener"
                  className="text-[var(--text)] underline underline-offset-[3px]"
                >
                  {chunks}
                </Link>
              ),
            })}
          </Label>
        </div>
        {errors.terms && (
          <p className="mt-1 text-[13px] text-[var(--color-brand-red-safe)]">
            {fieldError(errors.terms.message)}
          </p>
        )}
      </div>

      {/* Job C mounts the Cloudflare Turnstile widget here. */}
      <div data-turnstile-slot className="empty:hidden" />

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? t('signUpButton') + '…' : t('signUpButton')}
      </Button>
    </form>
  )
}
