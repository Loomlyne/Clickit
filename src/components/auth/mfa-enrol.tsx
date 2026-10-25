'use client'

import { CheckCircle2 } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useCallback, useEffect, useRef, useState } from 'react'

import { startEnrol, verifyEnrol, type MfaActionError } from '@/app/[locale]/(viewer)/auth/mfa/actions'
import { AuthAlert } from '@/components/auth/auth-alert'
import { AuthCardPage } from '@/components/auth/auth-card-page'
import { CodeField } from '@/components/auth/code-field'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { getPathname } from '@/i18n/navigation'
import { CODE_LENGTH } from '@/lib/auth-code'

type Step = 'scan' | 'code' | 'second' | 'done'
type Enrolment = { factorId: string; qr: string; manualKey: string }

const COPIED_MS = 2000

/**
 * Admin authenticator enrolment (UI-SPEC 6.5, D-18..D-20): scan, code, an
 * optional second authenticator, done. The QR and key live only in this
 * component's state; a page reload starts again at scan (the server removes
 * the unverified factor first).
 */
export function MfaEnrol({ next }: { next: string }) {
  const t = useTranslations('auth')
  const locale = useLocale()
  const tCommon = useTranslations('common')

  const [step, setStep] = useState<Step>('scan')
  // 1 = first authenticator, 2 = the optional second one (D-20).
  const [round, setRound] = useState<1 | 2>(1)
  const [enrolment, setEnrolment] = useState<Enrolment | null>(null)
  const [startError, setStartError] = useState<MfaActionError | null>(null)
  const [code, setCode] = useState('')
  const [codeError, setCodeError] = useState<string | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const started = useRef(false)
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Asks the server for a fresh enrolment. State is only set after the await.
  const load = useCallback(async () => {
    const result = await startEnrol()
    if (!result.ok) {
      // Signed out or no longer an admin: the page sends them where they belong.
      if (result.error === 'unauthorized') return window.location.reload()
      setStartError(result.error)
      return
    }
    setEnrolment({ factorId: result.factorId, qr: result.qr, manualKey: result.manualKey })
  }, [])

  useEffect(() => {
    // Once per mount (Strict Mode runs effects twice in dev).
    if (started.current) return
    started.current = true
    void load()
  }, [load])

  useEffect(
    () => () => {
      if (copiedTimer.current) clearTimeout(copiedTimer.current)
    },
    [],
  )

  async function copyKey() {
    if (!enrolment) return
    try {
      await navigator.clipboard.writeText(enrolment.manualKey.replace(/\s+/g, ''))
    } catch {
      return // clipboard refused: the key stays selectable (select-all)
    }
    setCopied(true)
    if (copiedTimer.current) clearTimeout(copiedTimer.current)
    copiedTimer.current = setTimeout(() => setCopied(false), COPIED_MS)
  }

  async function submit(value: string) {
    if (!enrolment || busy || value.length !== CODE_LENGTH) return
    setBusy(true)
    // Cleared first so the same message twice still clears and refocuses the field.
    setCodeError(undefined)
    const result = await verifyEnrol({ factorId: enrolment.factorId, code: value })
    setBusy(false)
    if (!result.ok) {
      if (result.error === 'unauthorized') return window.location.reload()
      if (result.error === 'mfaEnrolFailed') {
        setStartError('mfaEnrolFailed')
        return
      }
      setCodeError(t(result.error))
      return
    }
    setEnrolment(null)
    setCode('')
    setStep(round === 1 ? 'second' : 'done')
  }

  function addSecond() {
    setRound(2)
    setEnrolment(null)
    setStartError(null)
    setCode('')
    setCodeError(undefined)
    setStep('scan')
    void load()
  }

  function openAdmin() {
    // Full load into the admin tree after the aal change (see mfa-verify.tsx).
    window.location.replace(getPathname({ href: next, locale }))
  }

  const enrolTitle = round === 1 ? t('mfaEnrolTitle') : t('mfaSecondTitle')
  const codeTitle = round === 1 ? t('mfaStepCodeTitle') : t('mfaSecondTitle')

  if (step === 'second') {
    return (
      <AuthCardPage
        overline={t('mfaOverline')}
        title={t('mfaSecondTitle')}
        subline={t('mfaSecondSub')}
        icon={<CheckCircle2 className="size-5 text-[var(--color-brand-green-safe)]" />}
      >
        <div className="flex flex-col gap-2">
          <Button type="button" className="w-full text-sm font-bold" onClick={addSecond}>
            {t('mfaSecondAdd')}
          </Button>
          <Button
            type="button"
            variant="link"
            className="min-h-11 text-sm font-normal"
            onClick={() => setStep('done')}
          >
            {t('mfaSecondSkip')}
          </Button>
        </div>
      </AuthCardPage>
    )
  }

  if (step === 'done') {
    return (
      <AuthCardPage
        overline={t('mfaOverline')}
        title={t('mfaDoneTitle')}
        icon={<CheckCircle2 className="size-5 text-[var(--color-brand-green-safe)]" />}
      >
        <Button type="button" className="w-full text-sm font-bold" onClick={openAdmin} autoFocus>
          {t('mfaDoneOpen')}
        </Button>
      </AuthCardPage>
    )
  }

  if (startError) {
    return (
      <AuthCardPage overline={t('mfaOverline')} title={enrolTitle} step={{ current: 1, total: 2 }}>
        <AuthAlert variant="error">{t(startError === 'mfaTooMany' ? 'mfaTooMany' : 'mfaEnrolFailed')}</AuthAlert>
        <Button
          type="button"
          variant="outline"
          className="mt-4 w-full text-sm font-bold"
          onClick={() => window.location.reload()}
        >
          {tCommon('retry')}
        </Button>
      </AuthCardPage>
    )
  }

  if (step === 'code') {
    return (
      <AuthCardPage
        overline={t('mfaOverline')}
        title={codeTitle}
        subline={t('mfaStepCodeSub', { length: CODE_LENGTH })}
        step={{ current: 2, total: 2 }}
      >
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
              if (v) setCodeError(undefined)
            }}
            onComplete={(v) => void submit(v)}
            error={codeError}
            disabled={busy}
            autoFocus
          />
          <Button
            type="submit"
            className="w-full text-sm font-bold"
            disabled={busy || code.length !== CODE_LENGTH}
          >
            {t('mfaVerifyContinue')}
          </Button>
          <Button
            type="button"
            variant="link"
            className="min-h-11 text-sm font-normal"
            onClick={() => {
              setCodeError(undefined)
              setStep('scan')
            }}
            disabled={busy}
          >
            {t('mfaBack')}
          </Button>
        </form>
      </AuthCardPage>
    )
  }

  // step === 'scan'
  return (
    <AuthCardPage
      overline={t('mfaOverline')}
      title={enrolTitle}
      subline={t('mfaEnrolSub')}
      step={{ current: 1, total: 2 }}
    >
      <div className="flex flex-col gap-4" aria-busy={!enrolment}>
        {enrolment ? (
          // White frame: scanners need it; the only non-token surface (UI-SPEC 6.5). Never mirrored.
          <div dir="ltr" className="mx-auto size-48 rounded-card bg-white p-4">
            {/* eslint-disable-next-line @next/next/no-img-element -- Supabase returns an SVG data URI; next/image adds nothing */}
            <img src={enrolment.qr} alt={t('mfaQrAlt')} width={160} height={160} className="size-40" />
          </div>
        ) : (
          <Skeleton className="mx-auto size-48 rounded-card bg-[var(--bg-2)]" />
        )}

        <div>
          <p className="text-sm text-[var(--text-mute)]">{t('mfaManualKey')}</p>
          {enrolment ? (
            <p
              dir="ltr"
              className="mt-2 rounded-field bg-[var(--bg-2)] px-4 py-2 text-sm font-bold tracking-[0.12em] break-all text-[var(--text)] select-all"
            >
              {enrolment.manualKey}
            </p>
          ) : (
            <Skeleton className="mt-2 h-9 rounded-field bg-[var(--bg-2)]" />
          )}
          <Button
            type="button"
            variant="outline"
            className="mt-2 w-full text-sm font-bold"
            onClick={() => void copyKey()}
            disabled={!enrolment}
          >
            {copied ? t('keyCopied') : t('copyKey')}
          </Button>
          <span role="status" aria-live="polite" className="sr-only">
            {copied ? t('keyCopied') : ''}
          </span>
        </div>

        <Button
          type="button"
          className="w-full text-sm font-bold"
          onClick={() => setStep('code')}
          disabled={!enrolment}
        >
          {t('mfaNext')}
        </Button>
        {round === 2 && (
          // The second authenticator stays optional at every point (D-20, item 3).
          <Button
            type="button"
            variant="link"
            className="min-h-11 text-sm font-normal"
            onClick={() => setStep('done')}
          >
            {t('mfaSecondSkip')}
          </Button>
        )}
      </div>
    </AuthCardPage>
  )
}
