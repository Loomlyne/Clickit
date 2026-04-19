'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'

import { setLocaleAction } from '@/app/locale-actions'
import type { Locale } from '@/lib/locale'

/**
 * Tiny EN / AR pill toggle. Calls a Server Action to write the cookie, then
 * router.refresh() so server components re-render with the new locale.
 *
 * Why useTransition: hides any latency between cookie-write + revalidate so
 * the toggle feels instant and the active state doesn't flicker.
 */
export function LocaleSwitcher({ current }: { current: Locale }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function flip(next: Locale) {
    if (next === current || isPending) return
    startTransition(async () => {
      await setLocaleAction(next)
      router.refresh()
    })
  }

  return (
    <div
      role="group"
      aria-label="Language"
      className="inline-flex items-center gap-0.5 rounded-full border border-white/10 bg-white/[0.03] p-0.5 text-[11px] font-medium uppercase tracking-[0.18em]"
    >
      {(['en', 'ar'] as const).map((loc) => {
        const active = loc === current
        return (
          <button
            key={loc}
            type="button"
            onClick={() => flip(loc)}
            disabled={isPending}
            aria-pressed={active}
            className={
              active
                ? 'rounded-full bg-white px-2.5 py-1 text-black shadow-[0_4px_14px_rgba(255,255,255,0.18)]'
                : 'rounded-full px-2.5 py-1 text-white/56 transition-colors hover:text-white disabled:opacity-50'
            }
          >
            {loc}
          </button>
        )
      })}
    </div>
  )
}
