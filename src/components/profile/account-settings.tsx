'use client'

import { useState, useRef, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Check, Loader2, Mail, KeyRound, User } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { mapAuthError } from '@/lib/auth-errors'
import { PasswordField } from '@/components/auth/password-field'
import { PASSWORD_MIN } from '@/components/auth/password-rules'
import { createClient } from '@/lib/supabase/client'
import { updateProfile } from '@/app/[locale]/(viewer)/profile/actions'

interface AccountSettingsProps {
  displayName: string
  email: string
}

/**
 * Unified account editor — display name (inline auto-save), email change and
 * password change in one organized card. Email/password run through the
 * browser Supabase auth client; the display name persists via the existing
 * server action.
 */
export function AccountSettings({ displayName, email }: AccountSettingsProps) {
  const t = useTranslations('profile')
  const tCommon = useTranslations('common')

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
        <EmailRow email={email} t={t} tCommon={tCommon} />
        <PasswordRow t={t} tCommon={tCommon} />
      </div>
    </div>
  )
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

type T = ReturnType<typeof useTranslations>

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

/* ── Email change ─────────────────────────────────────────────────────── */

function EmailRow({ email, t, tCommon }: { email: string; t: T; tCommon: T }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function close() {
    setEditing(false)
    setValue('')
    setError(null)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const next = value.trim()
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(next)) {
      setError(t('emailInvalid'))
      toast.error(t('emailInvalid'))
      return
    }
    if (next === email) {
      close()
      return
    }
    setError(null)
    setSaving(true)
    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({
      email: next,
    })
    setSaving(false)
    if (updateError) {
      const message = updateError.message
        ? mapAuthError(updateError.message)
        : tCommon('error')
      setError(message)
      toast.error(message)
      return
    }
    toast.success(t('emailChangeSent'))
    close()
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
              autoFocus
              autoComplete="email"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={email}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? 'email-new-error' : undefined}
            />
            {error && (
              <p
                id="email-new-error"
                role="alert"
                className="mt-1 text-[13px] text-[var(--color-brand-red-safe)]"
              >
                {error}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={saving}>
              {saving ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : (
                tCommon('save')
              )}
            </Button>
            <Button type="button" variant="ghost" onClick={close}>
              {tCommon('cancel')}
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
    </FieldRow>
  )
}

/* ── Password change ──────────────────────────────────────────────────── */

function PasswordRow({ t, tCommon }: { t: T; tCommon: T }) {
  const [editing, setEditing] = useState(false)
  const [pw, setPw] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [pwError, setPwError] = useState<string | null>(null)
  const [confirmError, setConfirmError] = useState<string | null>(null)

  function reset() {
    setEditing(false)
    setPw('')
    setConfirm('')
    setPwError(null)
    setConfirmError(null)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setPwError(null)
    setConfirmError(null)
    if (pw.length < PASSWORD_MIN) {
      setPwError(t('passwordTooShort'))
      toast.error(t('passwordTooShort'))
      return
    }
    if (pw !== confirm) {
      setConfirmError(t('passwordMismatch'))
      toast.error(t('passwordMismatch'))
      return
    }
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: pw })
    setSaving(false)
    if (error) {
      const message = error.message
        ? mapAuthError(error.message)
        : tCommon('error')
      setPwError(message)
      toast.error(message)
      return
    }
    toast.success(t('passwordChanged'))
    reset()
  }

  return (
    <FieldRow icon={KeyRound} label={t('passwordLabel')}>
      {editing ? (
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          <div className="flex max-w-sm flex-col gap-4">
            <PasswordField
              id="password-new"
              label={t('newPasswordPlaceholder')}
              autoFocus
              autoComplete="new-password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              strengthOf={pw}
              error={pwError ?? undefined}
            />
            <PasswordField
              id="password-confirm"
              label={t('confirmPasswordPlaceholder')}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              error={confirmError ?? undefined}
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={saving}>
              {saving ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : (
                tCommon('save')
              )}
            </Button>
            <Button type="button" variant="ghost" onClick={reset}>
              {tCommon('cancel')}
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex min-h-11 items-center justify-between gap-3">
          <span
            aria-hidden
            className="text-sm tracking-[0.3em] text-[var(--text-mute)]"
          >
            ••••••••
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
    </FieldRow>
  )
}
