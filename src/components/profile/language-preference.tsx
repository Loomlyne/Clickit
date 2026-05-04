'use client'

import { useTransition } from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useRouter, usePathname } from '@/i18n/navigation'
import type { Locale } from '@/i18n/routing'

const options: Array<{ locale: Locale; label: string; sublabel: string }> = [
  { locale: 'en', label: 'English', sublabel: 'English' },
  { locale: 'ar', label: 'العربية', sublabel: 'Arabic' },
]

/**
 * URL-based locale switcher. Replaces the former cookie-based version.
 *
 * Click flow:
 *   1. usePathname() returns the current path WITHOUT the locale prefix
 *      (e.g., /profile — not /en/profile).
 *   2. router.replace(pathname, { locale: next }) re-navigates to the same
 *      path with the next locale prepended.
 *   3. No cookie write, no revalidatePath — the URL is the source of truth.
 *      next-intl automatically sets NEXT_LOCALE as a cookie on successful
 *      locale-prefixed navigation, so other code paths (e.g., the OAuth
 *      callback in plan 13-04) can still read it.
 *
 * useTransition hides any latency between the click and the re-navigation
 * so the active state doesn't flicker during concurrent rendering.
 */
export function LanguagePreference({ current }: { current: Locale }) {
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()

  function select(next: Locale) {
    if (next === current || isPending) return
    startTransition(() => {
      router.replace(pathname, { locale: next })
    })
  }

  return (
    <div className="flex gap-3">
      {options.map(({ locale, label, sublabel }) => {
        const active = locale === current
        return (
          <button
            key={locale}
            type="button"
            onClick={() => select(locale)}
            disabled={isPending}
            className={cn(
              'relative flex-1 rounded-[14px] border p-4 text-start transition-all duration-200 disabled:opacity-60',
              active
                ? 'border-[var(--line-2)] bg-[var(--bg-2)]'
                : 'border-[var(--line)] bg-[var(--bg-1)] hover:border-[var(--line-2)] hover:bg-[var(--bg-2)]'
            )}
          >
            {active && (
              <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-[8px] bg-[var(--accent-yellow)]">
                <Check className="h-3 w-3 text-[var(--accent-yellow-fg)]" strokeWidth={2.5} />
              </span>
            )}
            <p className="text-sm font-semibold text-white">{label}</p>
            <p className="mt-0.5 text-xs text-[var(--text-mute)]">{sublabel}</p>
          </button>
        )
      })}
    </div>
  )
}
