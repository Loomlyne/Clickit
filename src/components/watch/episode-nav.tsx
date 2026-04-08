'use client'

import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { ViewEpisode } from '@/lib/queries'

interface EpisodeNavProps {
  prev: ViewEpisode | null
  next: ViewEpisode | null
}

const baseClasses =
  'flex-1 min-h-[44px] rounded-[18px] border border-white/10 bg-white/[0.03] p-4 transition-colors duration-200'

const enabledClasses =
  'group text-muted-foreground hover:bg-surface-2/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

const disabledClasses =
  'opacity-50 pointer-events-none cursor-default text-text-muted border-border/50'

export function EpisodeNav({ prev, next }: EpisodeNavProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
      {/* Previous button */}
      {prev ? (
        <Link
          href={`/watch/${prev.id}`}
          className={cn(baseClasses, enabledClasses, 'flex items-center gap-3 justify-start')}
        >
          <ChevronLeft className="size-5 flex-shrink-0" />
          <div className="min-w-0">
            <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
              Previous
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
          <ChevronLeft className="size-5 flex-shrink-0" />
          <div className="min-w-0">
            <span className="text-sm">Previous</span>
          </div>
        </div>
      )}

      {/* Next button */}
      {next ? (
        <Link
          href={`/watch/${next.id}`}
          className={cn(baseClasses, enabledClasses, 'flex items-center gap-3 justify-end')}
        >
          <div className="min-w-0 text-right">
            <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
              Next
            </span>
            <span className="block text-sm font-bold text-foreground truncate">
              {next.title}
            </span>
          </div>
          <ChevronRight className="size-5 flex-shrink-0" />
        </Link>
      ) : (
        <div
          aria-disabled="true"
          tabIndex={-1}
          className={cn(baseClasses, disabledClasses, 'flex items-center gap-3 justify-end')}
        >
          <div className="min-w-0 text-right">
            <span className="text-sm">Next</span>
          </div>
          <ChevronRight className="size-5 flex-shrink-0" />
        </div>
      )}
    </div>
  )
}
