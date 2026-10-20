'use client'

import { useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertCircle, Eye, EyeOff, ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { mapAuthError } from '@/lib/auth-errors'
import { getSafeAuthNextPath } from '@/lib/auth-navigation'
import { signInAction } from '@/app/[locale]/(viewer)/auth/actions'
import {
  TurnstileField,
  useTurnstileToken,
} from '@/components/security/turnstile-field'
import { isCaptchaFailure } from '@/lib/turnstile-widget'

const loginSchema = z.object({
  email: z.string().email('emailInvalid'),
  password: z.string().min(6, 'passwordMin'),
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
  const [showPassword, setShowPassword] = useState(false)
  const [mode, setMode] = useState<'login' | 'forgot'>('login')
  const [resetSent, setResetSent] = useState(false)
  // Turnstile (PLAT-05): the token is single-use, so every submit consumes it
  // and the widget is remounted. Submit stays disabled until a token exists.
  const captcha = useTurnstileToken()
  const { needsToken, awaitingToken } = captcha

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  })

  const forgotForm = useForm<ForgotFormData>({
    resolver: zodResolver(forgotSchema),
  })

  async function onLogin(data: LoginFormData) {
    if (awaitingToken) return
    setServerError(null)
    captcha.setFailed(false)

    const result = await signInAction(
      data.email,
      data.password,
      captcha.token ?? undefined
    )

    if (!result.ok) {
      captcha.consume(isCaptchaFailure(result.error))
      // With the widget drawn, a captcha refusal shows under it (signed), not twice.
      setServerError(
        needsToken && isCaptchaFailure(result.error)
          ? null
          : mapAuthError(result.error)
      )
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
    if (awaitingToken) return
    setServerError(null)
    captcha.setFailed(false)
    const supabase = createClient()

    const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset-password`,
      captchaToken: captcha.token ?? undefined,
    })
    // The token is single-use: whatever the outcome, a fresh one is needed.
    captcha.consume(Boolean(error) && isCaptchaFailure(error?.message))

    if (error) {
      setServerError(
        needsToken && isCaptchaFailure(error.message)
          ? null
          : mapAuthError(error.message)
      )
      return
    }

    setResetSent(true)
  }

  if (mode === 'forgot') {
    return (
      <div className="space-y-3 md:space-y-4">
        <button
          type="button"
          onClick={() => {
            setMode('login')
            setServerError(null)
            setResetSent(false)
            captcha.clear()
          }}
          className="flex min-h-11 items-center gap-1.5 text-sm text-white/50 transition-colors hover:text-white/80"
        >
          <ArrowLeft className="size-3.5 rtl:scale-x-[-1]" />
          {t('backToSignIn')}
        </button>

        {resetSent ? (
          <div className="rounded-full border border-[#50A258]/25 bg-[#50A258]/10 px-4 py-4 text-sm text-green-300">
            <p className="font-medium">{t('resetEmailSent')}</p>
            <p className="mt-1 text-white/52">{t('resetEmailDescription')}</p>
          </div>
        ) : (
          <form
            onSubmit={forgotForm.handleSubmit(onForgot)}
            className="space-y-3 md:space-y-4"
          >
            {serverError && (
              <div className="rounded-full border border-[#DB3F34]/25 bg-[#DB3F34]/10 px-4 py-3 text-sm text-red-300">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{serverError}</span>
                </div>
              </div>
            )}

            <p className="text-sm text-white/52">{t('resetDescription')}</p>

            <div>
              <Label htmlFor="forgot-email">{t('email')}</Label>
              <Input
                id="forgot-email"
                type="email"
                placeholder={t('emailPlaceholder')}
                className="mt-1.5"
                {...forgotForm.register('email')}
              />
              {forgotForm.formState.errors.email && (
                <p className="text-brand-red-safe mt-1 text-xs">
                  {tErrors(forgotForm.formState.errors.email.message as never)}
                </p>
              )}
            </div>

            <TurnstileField
              key={captcha.widgetKey}
              form="reset"
              onToken={captcha.setToken}
              failed={captcha.failed}
            />

            <button
              type="submit"
              disabled={forgotForm.formState.isSubmitting || awaitingToken}
              className="bg-primary text-primary-foreground w-full rounded-full px-7 py-3 text-sm font-semibold transition-colors hover:bg-[#7082ff] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {forgotForm.formState.isSubmitting
                ? t('resetButton') + '…'
                : t('resetButton')}
            </button>
          </form>
        )}
      </div>
    )
  }

  return (
    <form
      onSubmit={loginForm.handleSubmit(onLogin)}
      className="space-y-3 md:space-y-4"
    >
      {serverError && (
        <div className="rounded-full border border-[#DB3F34]/25 bg-[#DB3F34]/10 px-4 py-3 text-sm text-red-300">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{serverError}</span>
          </div>
        </div>
      )}

      <div>
        <Label htmlFor="login-email">{t('email')}</Label>
        <Input
          id="login-email"
          type="email"
          placeholder={t('emailPlaceholder')}
          className="mt-1.5"
          {...loginForm.register('email')}
        />
        {loginForm.formState.errors.email && (
          <p className="text-brand-red-safe mt-1 text-xs">
            {tErrors(loginForm.formState.errors.email.message as never)}
          </p>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between">
          <Label htmlFor="login-password">{t('password')}</Label>
          <button
            type="button"
            onClick={() => {
              setMode('forgot')
              setServerError(null)
              captcha.clear()
            }}
            className="inline-flex min-h-11 items-center text-xs text-white/40 transition-colors hover:text-white/70"
          >
            {t('forgotPassword')}
          </button>
        </div>
        <div className="relative mt-1.5">
          <Input
            id="login-password"
            type={showPassword ? 'text' : 'password'}
            placeholder="••••••••"
            className="pe-10"
            {...loginForm.register('password')}
          />
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowPassword(!showPassword)}
            aria-label={showPassword ? t('hidePassword') : t('showPassword')}
            className="absolute top-1/2 end-3 -translate-y-1/2 text-white/40 transition-colors hover:text-white/70"
          >
            {showPassword ? (
              <EyeOff className="size-4" />
            ) : (
              <Eye className="size-4" />
            )}
          </button>
        </div>
        {loginForm.formState.errors.password && (
          <p className="text-brand-red-safe mt-1 text-xs">
            {tErrors(loginForm.formState.errors.password.message as never)}
          </p>
        )}
      </div>

      <TurnstileField
        key={captcha.widgetKey}
        form="sign-in"
        onToken={captcha.setToken}
        failed={captcha.failed}
      />

      <button
        type="submit"
        disabled={loginForm.formState.isSubmitting || awaitingToken}
        className="bg-primary text-primary-foreground w-full rounded-full px-7 py-3 text-sm font-semibold transition-colors hover:bg-[#7082ff] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loginForm.formState.isSubmitting
          ? t('signInButton') + '…'
          : t('signInButton')}
      </button>
    </form>
  )
}
