'use client'

import { Plus, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useWatchlist } from '@/hooks/use-watchlist'

interface WatchlistToggleButtonProps {
  showId: string
  variant: 'card' | 'hero'
  initialSaved?: boolean
  userId: string | null
}

export function WatchlistToggleButton({
  showId,
  variant,
  initialSaved = false,
  userId,
}: WatchlistToggleButtonProps) {
  const { isInList, toggle, isLoading } = useWatchlist(showId, initialSaved, userId)

  const Icon = isInList ? Check : Plus

  if (variant === 'card') {
    return (
      <button
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          toggle()
        }}
        disabled={isLoading}
        aria-label={isInList ? 'Remove from My List' : 'Add to My List'}
        className={cn(
          'absolute right-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-full transition-all duration-200',
          isInList
            ? 'border border-white bg-white text-black'
            : 'border border-white/20 bg-black/50 text-white/80 backdrop-blur-md hover:bg-black/70'
        )}
      >
        <Icon className="size-4" />
      </button>
    )
  }

  // Hero variant
  return (
    <button
      onClick={toggle}
      disabled={isLoading}
      aria-label={isInList ? 'Remove from My List' : 'Add to My List'}
      className={cn(
        'flex h-11 w-11 items-center justify-center rounded-full border backdrop-blur-sm transition-colors',
        isInList
          ? 'border-white bg-white text-black'
          : 'border-white/25 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
      )}
    >
      <Icon className="h-5 w-5" />
    </button>
  )
}
