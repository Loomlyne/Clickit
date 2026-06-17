'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import type { Provider } from '@supabase/supabase-js'
import { Separator } from '@/components/ui/separator'
import { createClient } from '@/lib/supabase/client'
import { getSafeAuthNextPath } from '@/lib/auth-navigation'

/**
 * Google / Apple sign-in buttons, shown only for providers the admin enabled
 * (Settings → Sign-in page). Clicking kicks off the real Supabase OAuth flow —
 * which requires the provider to be configured in the Supabase dashboard. If a
 * provider is toggled on here but not set up there, Supabase returns an error
 * and we surface it as a toast rather than failing silently.
 */
export function OAuthButtons({
  googleEnabled,
  appleEnabled,
}: {
  googleEnabled: boolean
  appleEnabled: boolean
}) {
  const t = useTranslations('auth')
  const searchParams = useSearchParams()
  const [pending, setPending] = useState<Provider | null>(null)

  if (!googleEnabled && !appleEnabled) return null

  async function signIn(provider: Provider) {
    setPending(provider)
    try {
      const supabase = createClient()
      const next = getSafeAuthNextPath(searchParams.get('next'), '/watch')
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo },
      })
      // On success the browser is redirected to the provider; this line is only
      // reached on error (e.g. provider not enabled in the Supabase dashboard).
      if (error) {
        toast.error(error.message)
        setPending(null)
      }
    } catch {
      toast.error(t('callbackError'))
      setPending(null)
    }
  }

  return (
    <>
      <div className="relative my-3 md:my-4">
        <Separator />
        <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[var(--bg-0)] px-3 text-xs text-white/40">
          {t('orContinueWith')}
        </span>
      </div>

      <div
        className={`grid gap-3 ${googleEnabled && appleEnabled ? 'grid-cols-2' : 'grid-cols-1'}`}
      >
        {googleEnabled && (
          <button
            type="button"
            disabled={pending !== null}
            onClick={() => signIn('google')}
            className="inline-flex items-center justify-center rounded-full border border-[var(--line)] bg-[var(--bg-2)] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--bg-3)] disabled:opacity-50"
          >
            {pending === 'google' ? '…' : 'Google'}
          </button>
        )}
        {appleEnabled && (
          <button
            type="button"
            disabled={pending !== null}
            onClick={() => signIn('apple')}
            className="inline-flex items-center justify-center rounded-full border border-[var(--line)] bg-[var(--bg-2)] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--bg-3)] disabled:opacity-50"
          >
            {pending === 'apple' ? '…' : 'Apple'}
          </button>
        )}
      </div>
    </>
  )
}
