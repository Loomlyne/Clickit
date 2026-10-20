'use client'

import { useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import { mapAuthError } from '@/lib/auth-errors'
import { getSafeAuthNextPath } from '@/lib/auth-navigation'
import { signInAction } from '@/app/[locale]/(viewer)/auth/actions'
import { AuthAlert } from './auth-alert'
import { PasswordField } from './password-field'
import { errorParams } from './password-rules'

// Sign-in only checks "not empty": accounts created before the 8-character
// minimum must still get in. The server is the judge of the credentials.
const loginSchema = z.object({
  email: z.string().email('emailInvalid'),
  password: z.string().min(1, 'passwordRequired'),
})

type LoginFormData = z.infer<typeof loginSchema>

const forgotSchema = z.object({
  email: z.string().email('emailInvalid'),
})

type ForgotFormData = z.infer<typeof forgotSchema>

export function LoginForm() {
  const t = useTranslations('auth')
  const tErrors = useTranslations('errors')
  const locale = useLocale()
  const searchParams = useSearchParams()
  const [serverError, setServerError] = useState<string | null>(null)
  const [mode, setMode] = useState<'login' | 'forgot'>('login')
  const [resetSent, setResetSent] = useState(false)

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  })

  const forgotForm = useForm<ForgotFormData>({
    resolver: zodResolver(forgotSchema),
  })

  const fieldError = (key?: string) =>
    key ? tErrors(key as never, errorParams(key) as never) : undefined

  async function onLogin(data: LoginFormData) {
    setServerError(null)

    const result = await signInAction(data.email, data.password)

    if (!result.ok) {
      setServerError(mapAuthError(result.error))
      return
    }

    const path = getSafeAuthNextPath(
      searchParams.get('next'),
      result.isAdmin ? '/admin' : '/watch'
    )
    toast.success(t('welcomeBack'))
    // Hard navigation: guarantees the browser sends the freshly persisted
    // sb-…-auth-token cookie so the middleware auth gate and the admin layout
    // render against a consistent session (no soft-nav race → no double-click).
    window.location.assign(`/${locale}${path}`)
  }

  async function onForgot(data: ForgotFormData) {
    setServerError(null)
    const supabase = createClient()

    const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset-password`,
    })

    if (error) {
      setServerError(mapAuthError(error.message))
      return
    }

    setResetSent(true)
  }

  if (mode === 'forgot') {
    return (
      <div className="flex flex-col gap-4">
        <button
          type="button"
          onClick={() => {
            setMode('login')
            setServerError(null)
            setResetSent(false)
          }}
          className="flex min-h-11 items-center gap-1.5 self-start text-sm text-[var(--text-dim)] transition-colors hover:text-[var(--text)]"
        >
          <ArrowLeft className="size-3.5 rtl:scale-x-[-1]" aria-hidden />
          {t('backToSignIn')}
        </button>

        {resetSent ? (
          <AuthAlert variant="success">
            <p className="font-medium">{t('resetEmailSent')}</p>
            <p className="mt-1 text-[var(--text-dim)]">
              {t('resetEmailDescription')}
            </p>
          </AuthAlert>
        ) : (
          <form
            onSubmit={forgotForm.handleSubmit(onForgot)}
            className="flex flex-col gap-4"
            noValidate
          >
            {serverError && (
              <AuthAlert variant="error">{serverError}</AuthAlert>
            )}

            <p className="text-sm text-[var(--text-dim)]">
              {t('resetDescription')}
            </p>

            <div>
              <Label htmlFor="forgot-email">{t('email')}</Label>
              <Input
                id="forgot-email"
                type="email"
                autoComplete="email"
                placeholder={t('emailPlaceholder')}
                className="mt-1.5"
                aria-invalid={
                  forgotForm.formState.errors.email ? true : undefined
                }
                {...forgotForm.register('email')}
              />
              {forgotForm.formState.errors.email && (
                <p className="mt-1 text-[13px] text-[var(--color-brand-red-safe)]">
                  {fieldError(forgotForm.formState.errors.email.message)}
                </p>
              )}
            </div>

            {/* Job C mounts the Cloudflare Turnstile widget here. */}
            <div data-turnstile-slot className="empty:hidden" />

            <Button
              type="submit"
              className="w-full"
              disabled={forgotForm.formState.isSubmitting}
            >
              {forgotForm.formState.isSubmitting
                ? t('resetButton') + '…'
                : t('resetButton')}
            </Button>
          </form>
        )}
      </div>
    )
  }

  return (
    <form
      onSubmit={loginForm.handleSubmit(onLogin)}
      className="flex flex-col gap-4"
      noValidate
    >
      {serverError && <AuthAlert variant="error">{serverError}</AuthAlert>}

      <div>
        <Label htmlFor="login-email">{t('email')}</Label>
        <Input
          id="login-email"
          type="email"
          autoComplete="email"
          placeholder={t('emailPlaceholder')}
          className="mt-1.5"
          aria-invalid={loginForm.formState.errors.email ? true : undefined}
          {...loginForm.register('email')}
        />
        {loginForm.formState.errors.email && (
          <p className="mt-1 text-[13px] text-[var(--color-brand-red-safe)]">
            {fieldError(loginForm.formState.errors.email.message)}
          </p>
        )}
      </div>

      <div>
        <PasswordField
          id="login-password"
          label={t('password')}
          autoComplete="current-password"
          placeholder="••••••••"
          error={fieldError(loginForm.formState.errors.password?.message)}
          {...loginForm.register('password')}
        />
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => {
              setMode('forgot')
              setServerError(null)
            }}
            className="inline-flex min-h-11 items-center text-[13px] text-[var(--text-dim)] underline underline-offset-[3px] transition-colors hover:text-[var(--text)]"
          >
            {t('forgotPassword')}
          </button>
        </div>
      </div>

      {/* Job C mounts the Cloudflare Turnstile widget here. */}
      <div data-turnstile-slot className="empty:hidden" />

      <Button
        type="submit"
        className="w-full"
        disabled={loginForm.formState.isSubmitting}
      >
        {loginForm.formState.isSubmitting
          ? t('signInButton') + '…'
          : t('signInButton')}
      </Button>
    </form>
  )
}
