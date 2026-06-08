'use client'

import { useState, useRef, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Check, Loader2, Mail, KeyRound, User } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
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
    <div className="rounded-[12px] border border-[var(--line)] bg-[var(--bg-1)] p-6">
      <h3 className="font-display mb-1 text-lg font-semibold tracking-[-0.02em] text-white">
        {t('accountHeading')}
      </h3>
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
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 py-5 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:gap-6">
      <div className="flex items-center gap-2 sm:w-40 sm:shrink-0 sm:pt-2">
        <Icon className="size-4 text-[var(--text-mute)]" />
        <span className="text-sm font-medium text-[var(--text-dim)]">
          {label}
        </span>
      </div>
      <div className="flex-1">{children}</div>
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
    <FieldRow icon={User} label={t('displayNameLabel')}>
      <div className="flex items-center gap-3">
        <Input
          id="display-name"
          value={name}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={t('nameInputPlaceholder')}
          className="max-w-sm"
        />
        {status === 'saving' && (
          <span className="flex items-center gap-1.5 text-xs text-[var(--text-mute)]">
            <Loader2 className="size-3 animate-spin" />
            {t('savingLabel')}
          </span>
        )}
        {status === 'saved' && (
          <span className="flex items-center gap-1.5 text-xs text-emerald-400/80">
            <Check className="size-3" />
            {t('savedLabel')}
          </span>
        )}
      </div>
    </FieldRow>
  )
}

/* ── Email change ─────────────────────────────────────────────────────── */

function EmailRow({ email, t, tCommon }: { email: string; t: T; tCommon: T }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const next = value.trim()
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(next)) {
      toast.error(t('emailInvalid'))
      return
    }
    if (next === email) {
      setEditing(false)
      return
    }
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ email: next })
    setSaving(false)
    if (error) {
      toast.error(error.message || tCommon('error'))
      return
    }
    toast.success(t('emailChangeSent'))
    setEditing(false)
    setValue('')
  }

  return (
    <FieldRow icon={Mail} label={t('emailLabel')}>
      {editing ? (
        <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row">
          <Input
            type="email"
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={email}
            className="max-w-sm"
          />
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                tCommon('save')
              )}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setEditing(false)
                setValue('')
              }}
            >
              {tCommon('cancel')}
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-white">{email}</span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="rounded-full"
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

  function reset() {
    setEditing(false)
    setPw('')
    setConfirm('')
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (pw.length < 8) {
      toast.error(t('passwordTooShort'))
      return
    }
    if (pw !== confirm) {
      toast.error(t('passwordMismatch'))
      return
    }
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: pw })
    setSaving(false)
    if (error) {
      toast.error(error.message || tCommon('error'))
      return
    }
    toast.success(t('passwordChanged'))
    reset()
  }

  return (
    <FieldRow icon={KeyRound} label={t('passwordLabel')}>
      {editing ? (
        <form onSubmit={submit} className="flex flex-col gap-3">
          <Input
            type="password"
            autoFocus
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder={t('newPasswordPlaceholder')}
            autoComplete="new-password"
            className="max-w-sm"
          />
          <Input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder={t('confirmPasswordPlaceholder')}
            autoComplete="new-password"
            className="max-w-sm"
          />
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                tCommon('save')
              )}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={reset}>
              {tCommon('cancel')}
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm tracking-[0.3em] text-[var(--text-mute)]">
            ••••••••
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="rounded-full"
            onClick={() => setEditing(true)}
          >
            {t('changeAction')}
          </Button>
        </div>
      )}
    </FieldRow>
  )
}
