'use client'

import { useCallback, useState } from 'react'
import { Turnstile } from '@marsidev/react-turnstile'
import { useLocale, useTranslations } from 'next-intl'

import {
  isTurnstileConfigured,
  turnstileWidgetOptions,
  type TurnstileForm,
} from '@/lib/turnstile-widget'

// Build-time public value. Empty means "not set up": the widget is not drawn
// and the form relies on the server refusing, so nothing here pretends to work.
const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

export function isTurnstileEnabled(): boolean {
  return isTurnstileConfigured(SITE_KEY)
}

/**
 * Token state for one form. The token is single-use (300 s, one siteverify),
 * so every submit attempt calls `consume()`: the token is cleared and the
 * widget is remounted (`widgetKey` changes) to get a fresh one. Submit stays
 * disabled while `awaitingToken` (only when a site key is configured).
 */
export function useTurnstileToken() {
  const [token, setToken] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const [widgetKey, setWidgetKey] = useState(0)
  const needsToken = isTurnstileEnabled()

  const consume = useCallback((captchaRefused = false) => {
    setToken(null)
    setFailed(captchaRefused)
    setWidgetKey((key) => key + 1)
  }, [])

  // Switching between two forms that share this state (sign-in / reset).
  const clear = useCallback(() => {
    setToken(null)
    setFailed(false)
  }, [])

  return {
    token,
    setToken,
    failed,
    setFailed,
    widgetKey,
    consume,
    clear,
    needsToken,
    awaitingToken: needsToken && !token,
  }
}

type TurnstileFieldProps = {
  form: TurnstileForm
  /** The current token, or null while the check runs, expired or failed. */
  onToken: (token: string | null) => void
  /** Set by the form when the server or Supabase refused the check. */
  failed?: boolean
  className?: string
}

export function TurnstileField({
  form,
  onToken,
  failed = false,
  className,
}: TurnstileFieldProps) {
  const locale = useLocale()
  const t = useTranslations('turnstile')
  const [widgetError, setWidgetError] = useState(false)

  if (!isTurnstileConfigured(SITE_KEY)) return null

  return (
    <div className={className}>
      <Turnstile
        siteKey={SITE_KEY as string}
        options={turnstileWidgetOptions({ form, locale })}
        className="w-full"
        onSuccess={(token) => {
          setWidgetError(false)
          onToken(token)
        }}
        onExpire={() => onToken(null)}
        onError={() => {
          setWidgetError(true)
          onToken(null)
        }}
      />
      {(failed || widgetError) && (
        <p role="alert" className="text-brand-red-safe mt-2 text-xs">
          {t('checkFailed')}
        </p>
      )}
    </div>
  )
}
