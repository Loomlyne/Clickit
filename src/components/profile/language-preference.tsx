'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { setLocaleAction } from '@/app/locale-actions'
import type { Locale } from '@/lib/locale'

const options = [
  { locale: 'en' as Locale, label: 'English', sublabel: 'English' },
  { locale: 'ar' as Locale, label: 'العربية', sublabel: 'Arabic' },
]

export function LanguagePreference({ current }: { current: Locale }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function select(next: Locale) {
    if (next === current || isPending) return
    startTransition(async () => {
      await setLocaleAction(next)
      router.refresh()
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
              'relative flex-1 rounded-[16px] border p-4 text-left transition-all duration-200 disabled:opacity-60',
              active
                ? 'border-white/30 bg-white/[0.08]'
                : 'border-white/[0.08] bg-white/[0.02] hover:border-white/[0.16] hover:bg-white/[0.04]'
            )}
          >
            {active && (
              <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-white">
                <Check className="h-3 w-3 text-black" strokeWidth={2.5} />
              </span>
            )}
            <p className="text-sm font-semibold text-white">{label}</p>
            <p className="mt-0.5 text-xs text-white/40">{sublabel}</p>
          </button>
        )
      })}
    </div>
  )
}
