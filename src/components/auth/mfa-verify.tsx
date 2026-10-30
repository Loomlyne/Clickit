'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useState } from 'react'

import { verifyAdminCode } from '@/app/[locale]/(viewer)/auth/mfa/actions'
import { AuthCardPage } from '@/components/auth/auth-card-page'
import { CodeField } from '@/components/auth/code-field'
import { Button } from '@/components/ui/button'
import { getPathname, useRouter } from '@/i18n/navigation'
import { CODE_LENGTH } from '@/lib/auth-code'
import { createClient } from '@/lib/supabase/client'

/**
 * Admin code page (UI-SPEC 6.6, D-19): one TOTP code from either
 * authenticator, checked on the server; success goes to `next` or /admin.
 */
export function MfaVerify({
  next,
  stale,
  staleHours,
}: {
  next: string
  stale: boolean
  staleHours: number
}) {
  const t = useTranslations('auth')
  const locale = useLocale()
  const tCommon = useTranslations('common')
  const router = useRouter()

  const [code, setCode] = useState('')
  const [error, setError] = useState<string | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  async function submit(value: string) {
    if (busy || done || value.length !== CODE_LENGTH) return
    setBusy(true)
    // Cleared first so the same message twice still clears and refocuses the field.
    setError(undefined)
    const result = await verifyAdminCode({ code: value, next })
    if (!result.ok) {
      setBusy(false)
      if (result.error === 'unauthorized') return window.location.reload()
      setError(t(result.error === 'mfaTooMany' ? 'mfaTooMany' : 'mfaCodeWrong'))
      return
    }
    setDone(true)
    // Full load, not router.replace: the session just became aal2 and the admin
    // layout is a different tree (admin.css); a soft swap from this page crashed
    // React (removeChild) on first arrival in local UAT 2026-10-25.
    window.location.replace(getPathname({ href: result.destination, locale }))
  }

  async function signOut() {
    // Same mechanism as the navbar's Sign out (auth-section.tsx).
    await createClient().auth.signOut()
    router.replace('/auth')
    router.refresh()
  }

  const subline = stale
    ? `${t('mfaVerifySub', { length: CODE_LENGTH })} ${t('mfaStaleNote', { hours: staleHours })}`
    : t('mfaVerifySub', { length: CODE_LENGTH })

  return (
    <AuthCardPage overline={t('mfaOverline')} title={t('mfaVerifyTitle')} subline={subline}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void submit(code)
        }}
        className="flex flex-col gap-4"
      >
        <CodeField
          label={t('codeLabel', { length: CODE_LENGTH })}
          value={code}
          onChange={(v) => {
            setCode(v)
            if (v) setError(undefined)
          }}
          onComplete={(v) => void submit(v)}
          error={error}
          disabled={busy || done}
          autoFocus
        />
        <Button
          type="submit"
          className="w-full text-sm font-bold"
          disabled={busy || done || code.length !== CODE_LENGTH}
        >
          {t('mfaVerifyContinue')}
        </Button>
        <p className="text-sm text-[var(--text-mute)]">{t('mfaLostPhone')}</p>
        <Button
          type="button"
          variant="link"
          className="min-h-11 self-start text-sm font-normal"
          onClick={() => void signOut()}
          disabled={busy}
        >
          {tCommon('signOut')}
        </Button>
      </form>
    </AuthCardPage>
  )
}
