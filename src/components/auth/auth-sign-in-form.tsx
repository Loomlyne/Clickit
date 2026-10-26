'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react'

import {
  requestPasswordReset,
  resendSignupLink,
  sendCode,
  signInWithPasswordAction,
  signUpWithPasswordAction,
  verifyCode,
} from '@/app/[locale]/(viewer)/auth/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  TurnstileField,
  useTurnstileToken,
} from '@/components/security/turnstile-field'
import { getPathname, Link } from '@/i18n/navigation'
import type { AuthInitialMode } from '@/lib/auth-navigation'
import {
  AUTH_LINK_MINUTES,
  CODE_LENGTH,
  formatCountdown,
  resendRemaining,
} from '@/lib/auth-code'
import type { AuthErrorKey } from '@/server/auth/sign-in-core'
import { AuthAlert, StatusLine } from './auth-alert'
import { CodeField } from './code-field'
import { PasswordField } from './password-field'
import { PASSWORD_MIN } from './password-rules'

export type AuthSignInMode =
  | 'email'
  | 'code-sent'
  | 'password'
  | 'signup-password'
  | 'forgot'

type AuthSignInFormProps = {
  /** Validated same-origin path ('' when none); the server action sends the viewer there. */
  next: string
  locale: string
  initialMode: AuthInitialMode
}

// Client hint only; the server re-checks with zod.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Link-buttons are --text-dim underlined, never accent (UI-SPEC Color).
const LINK_BUTTON =
  'inline-flex min-h-11 items-center gap-2 rounded-sm text-sm text-[var(--text-dim)] underline underline-offset-[3px] transition-colors outline-none hover:text-[var(--text)] focus-visible:ring-2 focus-visible:ring-[var(--primary)] disabled:pointer-events-none disabled:opacity-50'

const PRIMARY = 'mt-2 w-full text-sm font-bold'

/**
 * The unified sign-in screen (UI-SPEC 6.1; D-05..D-07, D-37): code first,
 * password behind "Use a password instead", sign-up and forgot password
 * behind the password path. Every action runs on the server; after a sign-in
 * the page does a full load into the destination (the session changed and the
 * next page may be another layout tree).
 */
export function AuthSignInForm({ next, locale, initialMode }: AuthSignInFormProps) {
  const t = useTranslations('auth')
  const tErrors = useTranslations('errors')
  const tTurnstile = useTranslations('turnstile')
  const authLocale = locale === 'ar' ? 'ar' : 'en'
  const nextOrNull = next || null

  const [mode, setMode] = useState<AuthSignInMode>(initialMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [signedIn, setSignedIn] = useState(false)

  const [formError, setFormError] = useState<string | null>(null)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | undefined>(undefined)
  const [codeError, setCodeError] = useState<string | undefined>(undefined)

  // Code (state 2) and check-your-email (state 4 success) share one 60 s window.
  const [sentAt, setSentAt] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [announce, setAnnounce] = useState('')
  const [signupSent, setSignupSent] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  const emailRef = useRef<HTMLInputElement>(null)

  // Turnstile: the managed widget for the first submit of each form, and a
  // separate interaction-only instance for Resend (UI-SPEC 5.5).
  const captcha = useTurnstileToken()
  const resendCaptcha = useTurnstileToken()

  const remaining = sentAt === null ? 0 : resendRemaining(sentAt, now)

  // Autofocus the email only where there is no on-screen keyboard to hide the page.
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    if (window.matchMedia('(hover: hover)').matches) emailRef.current?.focus()
  }, [])

  // Countdown tick. Not a live region; one announcement when resend opens.
  useEffect(() => {
    if (sentAt === null) return
    if (resendRemaining(sentAt, Date.now()) === 0) return
    const id = window.setInterval(() => {
      const current = Date.now()
      setNow(current)
      if (resendRemaining(sentAt, current) === 0) {
        window.clearInterval(id)
        setAnnounce(t('resendReady'))
      }
    }, 1000)
    return () => window.clearInterval(id)
  }, [sentAt, t])

  function messageFor(key: AuthErrorKey): string {
    switch (key) {
      case 'tooManyTries':
      case 'codeWrong':
      case 'codeSendFailed':
      case 'pwLeaked':
        return t(key)
      case 'captcha':
        return tTurnstile('checkFailed')
      case 'passwordMin':
        return tErrors('passwordMin', { min: PASSWORD_MIN })
      case 'authInvalidCredentials':
      case 'authEmailNotConfirmed':
      case 'authEmailTaken':
      case 'emailInvalid':
      case 'authGeneric':
        return tErrors(key)
    }
  }

  /** Routes a refusal to the field it belongs to, or to the form alert. */
  function showError(key: AuthErrorKey, widget: ReturnType<typeof useTurnstileToken>) {
    if (key === 'captcha' && widget.needsToken) return // signed line under the widget
    if (key === 'emailInvalid') return setEmailError(messageFor(key))
    if (key === 'passwordMin' || key === 'pwLeaked') return setPasswordError(messageFor(key))
    setFormError(messageFor(key))
  }

  function clearErrors() {
    setFormError(null)
    setEmailError(null)
    setPasswordError(undefined)
    setCodeError(undefined)
    captcha.setFailed(false)
    resendCaptcha.setFailed(false)
  }

  function switchMode(target: AuthSignInMode) {
    clearErrors()
    captcha.clear()
    setPassword('')
    setCode('')
    setSignupSent(false)
    setResetSent(false)
    setMode(target)
  }

  function checkEmail(): boolean {
    if (EMAIL_RE.test(email.trim())) return true
    setEmailError(tErrors('emailInvalid'))
    return false
  }

  function goTo(destination: string) {
    setSignedIn(true)
    // Full load, not router.replace: the session just changed and the
    // destination may be another layout tree (05-25 lesson). replace keeps
    // /auth out of the back stack.
    window.location.replace(getPathname({ href: destination, locale: authLocale }))
  }

  function startWindow() {
    const current = Date.now()
    setNow(current)
    setSentAt(current)
  }

  // ---------------------------------------------------------------- code path

  async function requestCode(widget: ReturnType<typeof useTurnstileToken>) {
    setBusy(true)
    clearErrors()
    try {
      const result = await sendCode({
        email: email.trim(),
        locale: authLocale,
        next: nextOrNull,
        captchaToken: widget.token ?? undefined,
      })
      widget.consume(!result.ok && result.error === 'captcha')
      if (!result.ok) return showError(result.error, widget)
      setCode('')
      startWindow()
      setMode('code-sent')
      setAnnounce(t('codeSentAnnounce', { email: email.trim() }))
    } catch {
      widget.consume()
      setFormError(tErrors('networkError'))
    } finally {
      setBusy(false)
    }
  }

  async function onSendCode(e: React.FormEvent) {
    e.preventDefault()
    if (busy || captcha.awaitingToken || !checkEmail()) return
    await requestCode(captcha)
  }

  async function onResendCode() {
    if (busy || remaining > 0 || resendCaptcha.awaitingToken) return
    await requestCode(resendCaptcha)
  }

  async function submitCode(value: string) {
    if (busy || signedIn || value.length !== CODE_LENGTH) return
    setBusy(true)
    // Cleared first so the same message twice still clears and refocuses the field.
    setCodeError(undefined)
    setFormError(null)
    try {
      const result = await verifyCode({
        email: email.trim(),
        code: value,
        locale: authLocale,
        next: nextOrNull,
      })
      if (!result.ok) {
        setBusy(false)
        const expired =
          result.error === 'codeWrong' &&
          sentAt !== null &&
          Date.now() - sentAt > AUTH_LINK_MINUTES * 60 * 1000
        setCodeError(expired ? t('codeExpired') : messageFor(result.error))
        return
      }
      goTo(result.destination)
    } catch {
      setBusy(false)
      setCodeError(tErrors('networkError'))
    }
  }

  // ---------------------------------------------------------------- password paths

  async function onPasswordSignIn(e: React.FormEvent) {
    e.preventDefault()
    if (busy || captcha.awaitingToken || !checkEmail()) return
    if (!password) return setPasswordError(tErrors('passwordRequired'))
    setBusy(true)
    clearErrors()
    try {
      const result = await signInWithPasswordAction({
        email: email.trim(),
        password,
        locale: authLocale,
        next: nextOrNull,
        captchaToken: captcha.token ?? undefined,
      })
      captcha.consume(!result.ok && result.error === 'captcha')
      if (!result.ok) {
        setBusy(false)
        return showError(result.error, captcha)
      }
      goTo(result.destination)
    } catch {
      captcha.consume()
      setBusy(false)
      setFormError(tErrors('networkError'))
    }
  }

  async function onSignUp(e: React.FormEvent) {
    e.preventDefault()
    if (busy || captcha.awaitingToken || !checkEmail()) return
    if (password.length < PASSWORD_MIN) return setPasswordError(messageFor('passwordMin'))
    setBusy(true)
    clearErrors()
    try {
      const result = await signUpWithPasswordAction({
        email: email.trim(),
        password,
        locale: authLocale,
        next: nextOrNull,
        captchaToken: captcha.token ?? undefined,
      })
      captcha.consume(!result.ok && result.error === 'captcha')
      if (!result.ok) {
        setBusy(false)
        return showError(result.error, captcha)
      }
      if (result.state === 'signed_in') return goTo(result.destination)
      setBusy(false)
      setPassword('')
      startWindow()
      setSignupSent(true)
    } catch {
      captcha.consume()
      setBusy(false)
      setFormError(tErrors('networkError'))
    }
  }

  async function onResendSignupLink() {
    if (busy || remaining > 0 || resendCaptcha.awaitingToken) return
    setBusy(true)
    clearErrors()
    try {
      const result = await resendSignupLink({
        email: email.trim(),
        locale: authLocale,
        next: nextOrNull,
        captchaToken: resendCaptcha.token ?? undefined,
      })
      resendCaptcha.consume(!result.ok && result.error === 'captcha')
      if (!result.ok) return showError(result.error, resendCaptcha)
      startWindow()
    } catch {
      resendCaptcha.consume()
      setFormError(tErrors('networkError'))
    } finally {
      setBusy(false)
    }
  }

  async function onForgot(e: React.FormEvent) {
    e.preventDefault()
    if (busy || captcha.awaitingToken || !checkEmail()) return
    setBusy(true)
    clearErrors()
    try {
      const result = await requestPasswordReset({
        email: email.trim(),
        locale: authLocale,
        next: nextOrNull,
        captchaToken: captcha.token ?? undefined,
      })
      captcha.consume(!result.ok && result.error === 'captcha')
      if (!result.ok) return showError(result.error, captcha)
      setResetSent(true)
    } catch {
      captcha.consume()
      setFormError(tErrors('networkError'))
    } finally {
      setBusy(false)
    }
  }

  // ---------------------------------------------------------------- pieces

  const bdi = (chunks: React.ReactNode) => <bdi dir="ltr">{chunks}</bdi>

  const heading =
    mode === 'password'
      ? t('signInTitle')
      : mode === 'signup-password'
        ? t('createAccountTitle')
        : mode === 'forgot'
          ? t('resetHeading')
          : t('signInOrJoinTitle')

  const subline =
    mode === 'password' || mode === 'signup-password'
      ? t('signInPasswordSub')
      : mode === 'forgot'
        ? t('resetDescription')
        : t('signInOrJoinSub', { length: CODE_LENGTH })

  const emailField = (
    <div>
      <Label htmlFor="auth-email" className="text-sm leading-normal font-normal">
        {t('email')}
      </Label>
      <Input
        ref={emailRef}
        id="auth-email"
        name="email"
        type="email"
        inputMode="email"
        dir="ltr"
        autoComplete={mode === 'password' || mode === 'signup-password' ? 'username' : 'email'}
        enterKeyHint={mode === 'email' ? 'send' : 'go'}
        placeholder={t('emailPlaceholder')}
        value={email}
        onChange={(e) => {
          setEmail(e.target.value)
          if (emailError) setEmailError(null)
        }}
        disabled={busy || signedIn}
        aria-invalid={emailError ? true : undefined}
        aria-describedby={emailError ? 'auth-email-error' : undefined}
        className="mt-2"
      />
      {emailError && (
        <p
          id="auth-email-error"
          role="alert"
          className="mt-2 text-sm text-[var(--color-brand-red-safe)]"
        >
          {emailError}
        </p>
      )}
    </div>
  )

  const mainWidget = (form: 'sign-in' | 'sign-up' | 'reset') => (
    <TurnstileField
      key={`${mode}-${captcha.widgetKey}`}
      form={form}
      onToken={captcha.setToken}
      failed={captcha.failed}
    />
  )

  const resendWidget = (
    <TurnstileField
      key={`resend-${resendCaptcha.widgetKey}`}
      form="resend"
      onToken={resendCaptcha.setToken}
      failed={resendCaptcha.failed}
      className="w-full"
    />
  )

  const resendRow = (label: string, onResend: () => void) =>
    remaining > 0 ? (
      <p className="mt-4 text-center text-sm text-[var(--text-mute)]">
        {t.rich('resendIn', { time: formatCountdown(remaining, locale), bdi })}
      </p>
    ) : (
      <div className="mt-4 flex flex-col items-center gap-2">
        {resendWidget}
        <button
          type="button"
          className={LINK_BUTTON}
          onClick={onResend}
          disabled={busy || resendCaptcha.awaitingToken}
        >
          {label}
        </button>
      </div>
    )

  const spinner = <Loader2 className="size-4 animate-spin" aria-hidden />

  // ---------------------------------------------------------------- render

  return (
    <div>
      {mode === 'forgot' && (
        <button
          type="button"
          className={`${LINK_BUTTON} mb-4 no-underline`}
          onClick={() => switchMode('password')}
        >
          <ArrowLeft className="size-4 rtl:scale-x-[-1]" aria-hidden />
          {t('backToSignIn')}
        </button>
      )}

      <h1 className="text-[24px] leading-[1.2] font-bold text-[var(--text)]">{heading}</h1>
      <p className="mt-2 mb-6 text-sm text-[var(--text-dim)]">{subline}</p>

      {/* Polite, once per event: code sent, resend open (UI-SPEC Accessibility). */}
      <p role="status" className="sr-only">
        {announce}
      </p>

      {formError && (
        <AuthAlert variant="error" className="mb-4">
          {formError}
        </AuthAlert>
      )}

      {mode === 'email' && (
        <form onSubmit={onSendCode} className="flex flex-col gap-4" method="post" noValidate>
          {emailField}
          {mainWidget('sign-in')}
          <Button type="submit" className={PRIMARY} disabled={busy || captcha.awaitingToken}>
            {busy ? (
              <>
                {spinner}
                {t('sending')}
              </>
            ) : (
              t('sendCode')
            )}
          </Button>
          <button
            type="button"
            className={`${LINK_BUTTON} self-center`}
            onClick={() => switchMode('password')}
          >
            {t('usePassword')}
          </button>
        </form>
      )}

      {mode === 'code-sent' && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void submitCode(code)
          }}
          className="flex flex-col gap-4"
          method="post"
          noValidate
        >
          <p className="flex flex-wrap items-center gap-x-2 text-sm text-[var(--text-dim)]">
            <span>{t.rich('codeSentTo', { email: email.trim(), bdi })}</span>
            <button
              type="button"
              className={LINK_BUTTON}
              onClick={() => {
                clearErrors()
                setCode('')
                setSentAt(null)
                setMode('email')
              }}
              disabled={busy || signedIn}
            >
              {t('changeEmail')}
            </button>
          </p>

          <CodeField
            id="auth-code"
            label={t('codeLabel', { length: CODE_LENGTH })}
            value={code}
            onChange={(v) => {
              setCode(v)
              if (v) setCodeError(undefined)
            }}
            onComplete={(v) => void submitCode(v)}
            error={codeError}
            helper={
              signedIn ? undefined : t('codeHelp', { minutes: AUTH_LINK_MINUTES })
            }
            disabled={busy || signedIn}
            autoFocus
          />

          {signedIn ? (
            <StatusLine
              icon={<CheckCircle2 className="text-[var(--color-brand-green-safe)]" />}
            >
              <span role="status">{t('signedIn')}</span>
            </StatusLine>
          ) : (
            <Button
              type="submit"
              className={PRIMARY}
              disabled={busy || code.length !== CODE_LENGTH}
            >
              {busy ? (
                <>
                  {spinner}
                  {t('verifying')}
                </>
              ) : (
                t('verifyCode')
              )}
            </Button>
          )}

          {!signedIn && resendRow(t('resendCode'), () => void onResendCode())}

          {!signedIn && (
            <button
              type="button"
              className={`${LINK_BUTTON} self-center`}
              onClick={() => switchMode('password')}
              disabled={busy}
            >
              {t('usePassword')}
            </button>
          )}
        </form>
      )}

      {mode === 'password' && (
        <form onSubmit={onPasswordSignIn} className="flex flex-col gap-4" method="post" noValidate>
          {emailField}
          <div className="flex flex-col">
            <PasswordField
              id="auth-password"
              name="password"
              label={t('password')}
              autoComplete="current-password"
              enterKeyHint="go"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                if (passwordError) setPasswordError(undefined)
              }}
              disabled={busy || signedIn}
              error={passwordError}
            />
            <button
              type="button"
              className={`${LINK_BUTTON} self-end`}
              onClick={() => switchMode('forgot')}
            >
              {t('forgotPassword')}
            </button>
          </div>
          {mainWidget('sign-in')}
          {signedIn ? (
            <StatusLine
              icon={<CheckCircle2 className="text-[var(--color-brand-green-safe)]" />}
            >
              <span role="status">{t('signedIn')}</span>
            </StatusLine>
          ) : (
            <Button type="submit" className={PRIMARY} disabled={busy || captcha.awaitingToken}>
              {busy && spinner}
              {t('signInButton')}
            </Button>
          )}
          <button
            type="button"
            className={`${LINK_BUTTON} self-center`}
            onClick={() => switchMode('email')}
            disabled={busy}
          >
            {t('useCode')}
          </button>
          <p className="flex flex-wrap items-center justify-center gap-x-2 text-sm text-[var(--text-mute)]">
            <span>{t('noAccountYet')}</span>
            <button
              type="button"
              className={LINK_BUTTON}
              onClick={() => switchMode('signup-password')}
              disabled={busy}
            >
              {t('createWithPassword')}
            </button>
          </p>
        </form>
      )}

      {mode === 'signup-password' &&
        (signupSent ? (
          <div className="flex flex-col">
            <AuthAlert variant="success">
              <p className="font-bold">{t('signupCheckEmailTitle')}</p>
              <p className="mt-1 text-[var(--text-dim)]">
                {t.rich('signupCheckEmailBody', {
                  email: email.trim(),
                  minutes: AUTH_LINK_MINUTES,
                  bdi,
                })}
              </p>
            </AuthAlert>
            {resendRow(t('resendConfirmation'), () => void onResendSignupLink())}
          </div>
        ) : (
          <form onSubmit={onSignUp} className="flex flex-col gap-4" method="post" noValidate>
            {emailField}
            <PasswordField
              id="auth-new-password"
              name="password"
              label={t('password')}
              autoComplete="new-password"
              enterKeyHint="go"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                if (passwordError) setPasswordError(undefined)
              }}
              strengthOf={password}
              disabled={busy || signedIn}
              error={passwordError}
            />
            {mainWidget('sign-up')}
            <Button type="submit" className={PRIMARY} disabled={busy || captcha.awaitingToken}>
              {busy && spinner}
              {t('signUpButton')}
            </Button>
            <p className="text-sm text-[var(--text-mute)]">
              {t.rich('termsLine', {
                terms: (chunks) => (
                  <Link
                    href="/terms"
                    className="text-[var(--text)] underline underline-offset-[3px]"
                  >
                    {chunks}
                  </Link>
                ),
                privacy: (chunks) => (
                  <Link
                    href="/privacy"
                    className="text-[var(--text)] underline underline-offset-[3px]"
                  >
                    {chunks}
                  </Link>
                ),
              })}
            </p>
            <button
              type="button"
              className={`${LINK_BUTTON} self-center`}
              onClick={() => switchMode('password')}
              disabled={busy}
            >
              {t('switchToSignIn')}
            </button>
          </form>
        ))}

      {mode === 'forgot' &&
        (resetSent ? (
          <AuthAlert variant="success">
            <p className="font-bold">{t('resetEmailSent')}</p>
            <p className="mt-1 text-[var(--text-dim)]">
              {t('resetEmailDescription', { minutes: AUTH_LINK_MINUTES })}
            </p>
          </AuthAlert>
        ) : (
          <form onSubmit={onForgot} className="flex flex-col gap-4" method="post" noValidate>
            {emailField}
            {mainWidget('reset')}
            <Button type="submit" className={PRIMARY} disabled={busy || captcha.awaitingToken}>
              {busy && spinner}
              {t('sendResetLink')}
            </Button>
          </form>
        ))}
    </div>
  )
}
