'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Bell, Check, Clock, Loader2, Mail, KeyRound, User } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { AuthAlert } from '@/components/auth/auth-alert'
import { CodeField } from '@/components/auth/code-field'
import { PasswordField } from '@/components/auth/password-field'
import { PASSWORD_MIN } from '@/components/auth/password-rules'
import {
  AUTH_LINK_MINUTES,
  CODE_LENGTH,
  formatCountdown,
  resendRemaining,
} from '@/lib/auth-code'
import {
  changeEmail,
  resendEmailChange,
  savePassword,
  setNotifyNewEpisodes,
  updateProfile,
  type ProfileErrorKey,
} from '@/app/[locale]/(viewer)/profile/actions'

interface AccountSettingsProps {
  displayName: string
  email: string
  locale: string
  /** profiles.password_set_at is set (D-09). */
  hasPassword: boolean
  /** profiles.notify_new_episodes (D-34, default on). */
  notifyNewEpisodes: boolean
  /** auth user.new_email while a Secure email change waits for both links (D-13). */
  pendingEmail: string | null
  /** auth user.email_change_sent_at (ISO) for the 60 s resend window. */
  emailChangeSentAt: string | null
}

// Link-buttons are --text-dim underlined, never accent (UI-SPEC Color).
const LINK_BUTTON =
  'inline-flex min-h-11 items-center gap-2 rounded-sm text-sm text-[var(--text-dim)] underline underline-offset-[3px] transition-colors outline-none hover:text-[var(--text)] focus-visible:ring-2 focus-visible:ring-[var(--primary)] disabled:pointer-events-none disabled:opacity-50'

const FIELD_ERROR = 'mt-2 text-sm text-[var(--color-brand-red-safe)]'

// Client hint only; the server re-checks with zod.
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

/**
 * Unified account editor (UI-SPEC 6.7): display name (inline auto-save),
 * email change with the pending state, set/change password with the optional
 * reauthentication step, and the new-episode emails switch. Every change runs
 * in a server action; nothing here calls the browser auth client.
 */
export function AccountSettings({
  displayName,
  email,
  locale,
  hasPassword,
  notifyNewEpisodes,
  pendingEmail,
  emailChangeSentAt,
}: AccountSettingsProps) {
  const t = useTranslations('profile')
  const tCommon = useTranslations('common')
  const authLocale = locale === 'ar' ? 'ar' : 'en'

  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--bg-1)] p-5 sm:p-6">
      <h2 className="font-display mb-1 text-lg font-semibold tracking-[-0.02em] text-[var(--text)]">
        {t('accountHeading')}
      </h2>
      <p className="mb-6 text-sm text-[var(--text-mute)]">
        {t('accountDescription')}
      </p>

      <div className="divide-y divide-[var(--line)]">
        <DisplayNameRow displayName={displayName} t={t} tCommon={tCommon} />
        <EmailRow
          email={email}
          locale={authLocale}
          initialPending={pendingEmail}
          initialSentAt={emailChangeSentAt}
        />
        <PasswordRow
          email={email}
          locale={authLocale}
          initialHasPassword={hasPassword}
        />
        <NotificationsRow initialOn={notifyNewEpisodes} />
      </div>
    </div>
  )
}

/* ── Shared helpers ───────────────────────────────────────────────────── */

type T = ReturnType<typeof useTranslations>

const bdi = (chunks: React.ReactNode) => <bdi dir="ltr">{chunks}</bdi>

/** i18n text for a server refusal (no English-only mapAuthError). */
function useProfileErrorText() {
  const t = useTranslations('profile')
  const tAuth = useTranslations('auth')
  const tErrors = useTranslations('errors')
  return (key: ProfileErrorKey): string => {
    switch (key) {
      case 'passwordMin':
        return tErrors('passwordMin', { min: PASSWORD_MIN })
      case 'passwordMismatch':
        return tErrors('passwordMismatch')
      case 'pwLeaked':
      case 'codeWrong':
      case 'tooManyTries':
        return tAuth(key)
      case 'emailInvalid':
        return t('emailInvalid')
      case 'authEmailTaken':
        return tErrors('authEmailTaken')
      case 'notSignedIn':
        return tErrors('authSessionExpired')
      case 'samePassword':
      case 'authGeneric':
        return tErrors('authGeneric')
    }
  }
}

/**
 * 60 s resend window (UI-SPEC 5.2 / 6.7). `now` stays null until the first
 * client tick so server and client render the same markup.
 */
function useResendWindow(initialSentAt: number | null) {
  const [sentAt, setSentAt] = useState<number | null>(initialSentAt)
  const [now, setNow] = useState<number | null>(null)

  useEffect(() => {
    if (sentAt === null) return
    const tick = () => setNow(Date.now())
    const first = window.setTimeout(tick, 0)
    const id = window.setInterval(() => {
      const current = Date.now()
      setNow(current)
      if (resendRemaining(sentAt, current) === 0) window.clearInterval(id)
    }, 1000)
    return () => {
      window.clearTimeout(first)
      window.clearInterval(id)
    }
  }, [sentAt])

  const ready = sentAt === null || now !== null
  const remaining = sentAt === null || now === null ? 0 : resendRemaining(sentAt, now)

  function start(at: number = Date.now()) {
    setNow(Date.now())
    setSentAt(at)
  }

  return { ready, remaining, start }
}

/* ── Reusable field row scaffold ──────────────────────────────────────── */

function FieldRow({
  icon: Icon,
  label,
  htmlFor,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  /** id of the input this row names; omit for rows that show a value. */
  htmlFor?: string
  children: React.ReactNode
}) {
  const labelClass = 'text-sm leading-normal font-medium text-[var(--text-dim)]'
  return (
    <div className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:gap-6">
      <div className="flex items-center gap-2 sm:min-h-11 sm:w-40 sm:shrink-0">
        <Icon className="size-4 text-[var(--text-mute)]" aria-hidden />
        {htmlFor ? (
          <Label htmlFor={htmlFor} className={labelClass}>
            {label}
          </Label>
        ) : (
          <span className={labelClass}>{label}</span>
        )}
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

/* ── Display name (inline auto-save) ──────────────────────────────────── */

function DisplayNameRow({
  displayName,
  t,
  tCommon,
}: {
  displayName: string
  t: T
  tCommon: T
}) {
  const [name, setName] = useState(displayName)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null)
  const lastSavedRef = useRef(displayName)

  const save = useCallback(
    async (value: string) => {
      if (value === lastSavedRef.current) return
      setStatus('saving')
      try {
        await updateProfile({ display_name: value })
        lastSavedRef.current = value
        setStatus('saved')
        setTimeout(() => setStatus((s) => (s === 'saved' ? 'idle' : s)), 2000)
      } catch {
        toast.error(tCommon('error'))
        setStatus('idle')
      }
    },
    [tCommon]
  )

  function handleChange(value: string) {
    setName(value)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => save(value), 800)
  }

  return (
    <FieldRow icon={User} label={t('displayNameLabel')} htmlFor="display-name">
      <div className="flex items-center gap-3">
        <Input
          id="display-name"
          value={name}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={t('nameInputPlaceholder')}
          autoComplete="name"
          className="max-w-sm"
        />
        <span role="status" className="shrink-0">
          {status === 'saving' && (
            <span className="flex items-center gap-1.5 text-[13px] text-[var(--text-mute)]">
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
              {t('savingLabel')}
            </span>
          )}
          {status === 'saved' && (
            <span className="flex items-center gap-1.5 text-[13px] text-[var(--color-brand-green-safe)]">
              <Check className="size-3.5" aria-hidden />
              {t('savedLabel')}
            </span>
          )}
        </span>
      </div>
    </FieldRow>
  )
}

/* ── Email change (D-13) ──────────────────────────────────────────────── */

function parseIsoMs(value: string | null): number | null {
  if (!value) return null
  const ms = Date.parse(value)
  return Number.isFinite(ms) ? ms : null
}

function EmailRow({
  email,
  locale,
  initialPending,
  initialSentAt,
}: {
  email: string
  locale: 'en' | 'ar'
  initialPending: string | null
  initialSentAt: string | null
}) {
  const t = useTranslations('profile')
  const tErrors = useTranslations('errors')
  const errorText = useProfileErrorText()

  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<string | null>(initialPending)
  const [resending, setResending] = useState(false)
  const windowState = useResendWindow(initialPending ? parseIsoMs(initialSentAt) : null)

  function close() {
    setEditing(false)
    setValue('')
    setError(null)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (saving) return
    const next = value.trim()
    if (!EMAIL_RE.test(next)) {
      setError(t('emailInvalid'))
      toast.error(t('emailInvalid'))
      return
    }
    if (next.toLowerCase() === email.toLowerCase()) {
      close()
      return
    }
    setError(null)
    setSaving(true)
    try {
      const result = await changeEmail({ email: next, locale })
      if (!result.ok) {
        const message = errorText(result.error)
        setError(message)
        toast.error(message)
        return
      }
      if (result.pendingEmail) {
        setPending(result.pendingEmail)
        windowState.start(result.sentAt ?? Date.now())
        toast.success(t('emailChangeSent'))
      }
      close()
    } catch {
      setError(tErrors('networkError'))
      toast.error(tErrors('networkError'))
    } finally {
      setSaving(false)
    }
  }

  async function resend() {
    if (resending || windowState.remaining > 0) return
    setResending(true)
    try {
      const result = await resendEmailChange({ locale })
      if (!result.ok) {
        toast.error(errorText(result.error))
        return
      }
      if (!result.sent) {
        // Already confirmed elsewhere: nothing is pending any more.
        setPending(null)
        return
      }
      windowState.start(result.sentAt ?? Date.now())
      toast.success(t('linksResent'))
    } catch {
      toast.error(tErrors('networkError'))
    } finally {
      setResending(false)
    }
  }

  return (
    <FieldRow
      icon={Mail}
      label={t('emailLabel')}
      htmlFor={editing ? 'email-new' : undefined}
    >
      {editing ? (
        <form onSubmit={submit} noValidate className="flex flex-col gap-3">
          <div className="max-w-sm">
            <Input
              id="email-new"
              type="email"
              inputMode="email"
              dir="ltr"
              autoFocus
              autoComplete="email"
              value={value}
              onChange={(e) => {
                setValue(e.target.value)
                if (error) setError(null)
              }}
              placeholder={email}
              disabled={saving}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? 'email-new-error' : undefined}
            />
            {error && (
              <p id="email-new-error" role="alert" className={FIELD_ERROR}>
                {error}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="animate-spin" aria-hidden />}
              {t('saveEmail')}
            </Button>
            <Button type="button" variant="ghost" onClick={close} disabled={saving}>
              {t('discardChanges')}
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex min-h-11 items-center justify-between gap-3">
          <span className="min-w-0 text-sm break-all text-[var(--text)]">
            {email}
          </span>
          <Button
            type="button"
            variant="outline"
            onClick={() => setEditing(true)}
          >
            {t('changeAction')}
          </Button>
        </div>
      )}

      {pending && (
        <div className="mt-3 rounded-field border border-[var(--line-2)] bg-[var(--bg-2)] p-4">
          <div className="flex items-start gap-2">
            <span className="flex h-5 shrink-0 items-center">
              <Clock className="size-4 text-[var(--text-mute)]" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold text-[var(--text)]">
                {t('emailPendingTitle')}
              </p>
              <p className="mt-1 text-sm break-words text-[var(--text-dim)]">
                {t.rich('emailPendingBody', { email: pending, bdi })}
              </p>
              {/* 60 s window: the button stays visible but disabled with the clock
                  beside it ("Resend code in" names a code, not links). The clock is
                  not a live region (UI-SPEC Accessibility). */}
              {windowState.ready && (
                <div className="mt-1 flex items-center gap-2">
                  <button
                    type="button"
                    className={LINK_BUTTON}
                    onClick={() => void resend()}
                    disabled={resending || windowState.remaining > 0}
                  >
                    {resending && <Loader2 className="size-4 animate-spin" aria-hidden />}
                    {t('resendLinks')}
                  </button>
                  {windowState.remaining > 0 && (
                    <span className="text-sm text-[var(--text-mute)]">
                      <bdi dir="ltr">{formatCountdown(windowState.remaining, locale)}</bdi>
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </FieldRow>
  )
}

/* ── Password set / change (D-09, D-11, F15) ──────────────────────────── */

function PasswordRow({
  email,
  locale,
  initialHasPassword,
}: {
  email: string
  locale: 'en' | 'ar'
  initialHasPassword: boolean
}) {
  const t = useTranslations('profile')
  const tAuth = useTranslations('auth')
  const tErrors = useTranslations('errors')
  const errorText = useProfileErrorText()

  const [hasPassword, setHasPassword] = useState(initialHasPassword)
  const [editing, setEditing] = useState(false)
  const [step, setStep] = useState<'form' | 'code'>('form')
  const [pw, setPw] = useState('')
  const [confirm, setConfirm] = useState('')
  const [code, setCode] = useState('')
  const [saving, setSaving] = useState(false)
  const [pwError, setPwError] = useState<string | undefined>(undefined)
  const [confirmError, setConfirmError] = useState<string | undefined>(undefined)
  const [formError, setFormError] = useState<string | null>(null)
  const [codeError, setCodeError] = useState<string | undefined>(undefined)
  const [codeSentAt, setCodeSentAt] = useState<number | null>(null)
  const [announce, setAnnounce] = useState('')
  const windowState = useResendWindow(null)

  function clearErrors() {
    setPwError(undefined)
    setConfirmError(undefined)
    setFormError(null)
    setCodeError(undefined)
  }

  function reset() {
    setEditing(false)
    setStep('form')
    setPw('')
    setConfirm('')
    setCode('')
    setCodeSentAt(null)
    clearErrors()
  }

  function showError(key: ProfileErrorKey) {
    const message = errorText(key)
    if (key === 'passwordMin' || key === 'pwLeaked' || key === 'samePassword') {
      setStep('form')
      return setPwError(message)
    }
    if (key === 'passwordMismatch') {
      setStep('form')
      return setConfirmError(message)
    }
    setFormError(message)
  }

  function saved(wasSet: boolean) {
    toast.success(wasSet ? t('passwordChanged') : t('passwordAdded'))
    setHasPassword(true)
    reset()
  }

  function codeSent() {
    const at = Date.now()
    setCode('')
    setCodeSentAt(at)
    windowState.start(at)
    setStep('code')
    setAnnounce(tAuth('codeSentAnnounce', { email }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (saving) return
    clearErrors()
    if (pw.length < PASSWORD_MIN) return showError('passwordMin')
    if (pw !== confirm) return showError('passwordMismatch')
    setSaving(true)
    try {
      const result = await savePassword({ password: pw, confirm })
      if (result.ok) return saved(result.wasSet)
      if ('state' in result) return codeSent()
      showError(result.error)
    } catch {
      setFormError(tErrors('networkError'))
    } finally {
      setSaving(false)
    }
  }

  async function submitCode(value: string) {
    if (saving || value.length !== CODE_LENGTH) return
    setSaving(true)
    // Cleared first so the same message twice still clears and refocuses the field.
    setCodeError(undefined)
    setFormError(null)
    try {
      const result = await savePassword({ password: pw, confirm, nonce: value })
      if (result.ok) return saved(result.wasSet)
      if ('state' in result) return codeSent()
      if (result.error === 'codeWrong' || result.error === 'tooManyTries') {
        const expired =
          result.error === 'codeWrong' &&
          codeSentAt !== null &&
          Date.now() - codeSentAt > AUTH_LINK_MINUTES * 60 * 1000
        return setCodeError(expired ? tAuth('codeExpired') : errorText(result.error))
      }
      showError(result.error)
    } catch {
      setCodeError(tErrors('networkError'))
    } finally {
      setSaving(false)
    }
  }

  async function resendCode() {
    if (saving || windowState.remaining > 0) return
    setSaving(true)
    setCodeError(undefined)
    setFormError(null)
    try {
      // Without a nonce Supabase asks again and a new code is emailed.
      const result = await savePassword({ password: pw, confirm })
      if (result.ok) return saved(result.wasSet)
      if ('state' in result) return codeSent()
      showError(result.error)
    } catch {
      setFormError(tErrors('networkError'))
    } finally {
      setSaving(false)
    }
  }

  const spinner = <Loader2 className="animate-spin" aria-hidden />

  return (
    <FieldRow icon={KeyRound} label={t('passwordLabel')}>
      <span role="status" className="sr-only">
        {announce}
      </span>
      {!editing ? (
        <div className="flex min-h-11 items-center justify-between gap-3">
          {hasPassword ? (
            <span
              aria-hidden
              className="text-sm tracking-[0.3em] text-[var(--text-mute)]"
            >
              ••••••••
            </span>
          ) : (
            <div className="min-w-0">
              <p className="text-sm text-[var(--text-mute)]">{t('passwordNotSet')}</p>
              <p className="mt-1 text-sm text-[var(--text-mute)]">{t('passwordSetHint')}</p>
            </div>
          )}
          <Button
            type="button"
            variant="outline"
            className="shrink-0"
            onClick={() => setEditing(true)}
          >
            {hasPassword ? t('changePassword') : t('setPassword')}
          </Button>
        </div>
      ) : step === 'form' ? (
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          <div className="flex max-w-sm flex-col gap-4">
            <PasswordField
              id="password-new"
              label={t('newPasswordPlaceholder')}
              autoFocus
              autoComplete="new-password"
              value={pw}
              onChange={(e) => {
                setPw(e.target.value)
                if (pwError) setPwError(undefined)
              }}
              strengthOf={pw}
              error={pwError}
              disabled={saving}
            />
            <PasswordField
              id="password-confirm"
              label={t('confirmPasswordPlaceholder')}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => {
                setConfirm(e.target.value)
                if (confirmError) setConfirmError(undefined)
              }}
              error={confirmError}
              disabled={saving}
            />
          </div>
          {formError && (
            <AuthAlert variant="error" className="max-w-sm">
              {formError}
            </AuthAlert>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={saving}>
              {saving && spinner}
              {t('savePassword')}
            </Button>
            <Button type="button" variant="ghost" onClick={reset} disabled={saving}>
              {t('discardChanges')}
            </Button>
          </div>
        </form>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void submitCode(code)
          }}
          noValidate
          className="flex max-w-sm flex-col gap-4"
        >
          <div>
            <h3 className="text-xl font-bold text-[var(--text)]">{t('reauthTitle')}</h3>
            <p className="mt-2 text-sm break-words text-[var(--text-dim)]">
              {t.rich('reauthSub', { email, bdi })}
            </p>
          </div>
          <CodeField
            id="password-reauth-code"
            label={tAuth('codeLabel', { length: CODE_LENGTH })}
            value={code}
            onChange={(v) => {
              setCode(v)
              if (v) setCodeError(undefined)
            }}
            onComplete={(v) => void submitCode(v)}
            error={codeError}
            helper={tAuth('codeHelp', { minutes: AUTH_LINK_MINUTES })}
            disabled={saving}
            autoFocus
          />
          {formError && <AuthAlert variant="error">{formError}</AuthAlert>}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={saving || code.length !== CODE_LENGTH}>
              {saving && spinner}
              {t('confirmPasswordChange')}
            </Button>
            <Button type="button" variant="ghost" onClick={reset} disabled={saving}>
              {t('discardChanges')}
            </Button>
          </div>
          {windowState.ready &&
            (windowState.remaining > 0 ? (
              <p className="text-sm text-[var(--text-mute)]">
                {tAuth.rich('resendIn', {
                  time: formatCountdown(windowState.remaining, locale),
                  bdi,
                })}
              </p>
            ) : (
              <button
                type="button"
                className={LINK_BUTTON}
                onClick={() => void resendCode()}
                disabled={saving}
              >
                {tAuth('resendCode')}
              </button>
            ))}
        </form>
      )}
    </FieldRow>
  )
}

/* ── New episode emails (D-34, D-35) ──────────────────────────────────── */

function NotificationsRow({ initialOn }: { initialOn: boolean }) {
  const t = useTranslations('profile')
  const [on, setOn] = useState(initialOn)
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)
  const [announce, setAnnounce] = useState('')

  async function toggle(next: boolean) {
    if (saving) return
    const previous = on
    setFailed(false)
    setOn(next) // optimistic
    setSaving(true)
    try {
      const result = await setNotifyNewEpisodes(next)
      if (!result.ok) throw new Error('save failed')
      setOn(result.on)
      setAnnounce(result.on ? t('notifOn') : t('notifOff'))
    } catch {
      setOn(previous) // rollback
      setFailed(true)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="py-4 first:pt-0 last:pb-0">
      <div className="flex min-h-11 items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-2">
          <span className="flex h-5 shrink-0 items-center">
            <Bell className="size-4 text-[var(--text-mute)]" aria-hidden />
          </span>
          <div className="min-w-0">
            <p id="notif-label" className="text-sm font-bold text-[var(--text)]">
              {t('notifLabel')}
            </p>
            <p id="notif-help" className="mt-1 text-sm text-[var(--text-mute)]">
              {t('notifHelp')}
            </p>
          </div>
        </div>
        {/* The 44px wrapper is centred on the label line (20px). */}
        <div className="-my-3 shrink-0">
          <Switch
            checked={on}
            onCheckedChange={(checked) => void toggle(checked)}
            disabled={saving}
            aria-busy={saving}
            aria-labelledby="notif-label"
            aria-describedby="notif-help"
          />
        </div>
      </div>
      <span role="status" aria-live="polite" className="sr-only">
        {announce}
      </span>
      {failed && (
        <p role="alert" className={FIELD_ERROR}>
          {t('notifSaveFailed')}
        </p>
      )}
    </div>
  )
}
