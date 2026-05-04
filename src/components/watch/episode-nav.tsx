'use client'

import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { ViewEpisode } from '@/lib/queries'

interface EpisodeNavProps {
  prev: ViewEpisode | null
  next: ViewEpisode | null
}

const baseClasses =
  'flex-1 min-h-[44px] rounded-[8px] border border-[var(--line)] bg-[var(--bg-2)] p-3.5 transition-[background,border-color,transform] duration-150'

const enabledClasses =
  'group text-[var(--text-dim)] hover:bg-[var(--bg-3)] hover:border-[var(--line-2)] hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

const disabledClasses =
  'opacity-50 pointer-events-none cursor-default text-[var(--text-mute)]'

export function EpisodeNav({ prev, next }: EpisodeNavProps) {
  const t = useTranslations('common')
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
      {/* Previous button */}
      {prev ? (
        <Link
          href={`/watch/${prev.id}`}
          className={cn(baseClasses, enabledClasses, 'flex items-center gap-3 justify-start')}
        >
          <ChevronLeft className="size-5 flex-shrink-0 rtl:scale-x-[-1]" />
          <div className="min-w-0">
            <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
              {t('previous')}
            </span>
            <span className="block text-sm font-bold text-foreground truncate">
              {prev.title}
            </span>
          </div>
        </Link>
      ) : (
        <div
          aria-disabled="true"
          tabIndex={-1}
          className={cn(baseClasses, disabledClasses, 'flex items-center gap-3 justify-start')}
        >
          <ChevronLeft className="size-5 flex-shrink-0 rtl:scale-x-[-1]" />
          <div className="min-w-0">
            <span className="text-sm">{t('previous')}</span>
          </div>
        </div>
      )}

      {/* Next button */}
      {next ? (
        <Link
          href={`/watch/${next.id}`}
          className={cn(baseClasses, enabledClasses, 'flex items-center gap-3 justify-end')}
        >
          <div className="min-w-0 text-end">
            <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
              {t('next')}
            </span>
            <span className="block text-sm font-bold text-foreground truncate">
              {next.title}
            </span>
          </div>
          <ChevronRight className="size-5 flex-shrink-0 rtl:scale-x-[-1]" />
        </Link>
      ) : (
        <div
          aria-disabled="true"
          tabIndex={-1}
          className={cn(baseClasses, disabledClasses, 'flex items-center gap-3 justify-end')}
        >
          <div className="min-w-0 text-end">
            <span className="text-sm">{t('next')}</span>
          </div>
          <ChevronRight className="size-5 flex-shrink-0 rtl:scale-x-[-1]" />
        </div>
      )}
    </div>
  )
}
