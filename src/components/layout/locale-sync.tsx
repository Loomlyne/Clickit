'use client'

import { useEffect } from 'react'
import { useLocale } from 'next-intl'

import { syncLocale } from '@/app/[locale]/(viewer)/profile/actions'
import { LOCALE_SYNC_KEY, shouldSyncLocale } from '@/lib/locale-sync-core'

function readLastSynced(): string | null {
  try {
    return window.sessionStorage.getItem(LOCALE_SYNC_KEY)
  } catch {
    return null
  }
}

function storeLastSynced(locale: string) {
  try {
    window.sessionStorage.setItem(LOCALE_SYNC_KEY, locale)
  } catch {
    // Storage blocked: the next render simply syncs again.
  }
}

/**
 * Silent language sync (D-15 / Q6 = A; UI-SPEC 6.7): mirrors the language the
 * signed-in viewer is using to profiles.locale and user_metadata.locale, which
 * pick the email language. Renders nothing; no toast, spinner or focus move.
 * A failure leaves the stored value alone so the next render retries.
 */
export function LocaleSync() {
  const locale = useLocale()

  useEffect(() => {
    if (!shouldSyncLocale(locale, readLastSynced())) return
    let cancelled = false
    syncLocale(locale)
      .then((result) => {
        if (!cancelled && result.ok) storeLastSynced(locale)
      })
      .catch((err: unknown) => {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[locale-sync] failed', err instanceof Error ? err.name : 'error')
        }
      })
    return () => {
      cancelled = true
    }
  }, [locale])

  return null
}
