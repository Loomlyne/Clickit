'use client'

import { useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Plus, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useWatchlist } from '@/hooks/use-watchlist'

const SPRING = { type: 'spring' as const, stiffness: 500, damping: 25 }

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
  const justAddedRef = useRef(false)

  const handleClick = (e?: React.MouseEvent) => {
    if (e) { e.preventDefault(); e.stopPropagation() }
    if (!isInList) justAddedRef.current = true
    toggle()
  }

  const iconSize = variant === 'card' ? 'size-4' : 'h-5 w-5'

  const iconContent = (
    <span className="relative flex items-center justify-center">
      {/* Confirmation ring on add */}
      <AnimatePresence>
        {isInList && justAddedRef.current && (
          <motion.span
            key="ring"
            className={cn(
              'absolute inset-0 rounded-full border-2',
              variant === 'card' ? 'border-white/60' : 'border-white/50'
            )}
            initial={{ scale: 1, opacity: 0.7 }}
            animate={{ scale: 1.7, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
            onAnimationComplete={() => { justAddedRef.current = false }}
          />
        )}
      </AnimatePresence>

      {/* Icon with spring swap */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={isInList ? 'check' : 'plus'}
          initial={{ scale: 0.3, rotate: -90, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          exit={{ scale: 0.3, rotate: 90, opacity: 0 }}
          transition={SPRING}
          className="flex items-center justify-center"
        >
          {isInList ? <Check className={iconSize} strokeWidth={3} /> : <Plus className={iconSize} />}
        </motion.span>
      </AnimatePresence>
    </span>
  )

  if (variant === 'card') {
    return (
      <motion.button
        onClick={handleClick}
        disabled={isLoading}
        whileTap={{ scale: 0.85 }}
        aria-label={isInList ? 'Remove from My List' : 'Add to My List'}
        className={cn(
          'absolute right-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-full transition-all duration-200',
          isInList
            ? 'border border-white bg-white text-black'
            : 'border border-white/20 bg-black/50 text-white/80 backdrop-blur-md hover:bg-black/70'
        )}
      >
        {iconContent}
      </motion.button>
    )
  }

  return (
    <motion.button
      onClick={() => handleClick()}
      disabled={isLoading}
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.9 }}
      aria-label={isInList ? 'Remove from My List' : 'Add to My List'}
      className={cn(
        'flex h-11 w-11 items-center justify-center rounded-full border backdrop-blur-sm transition-colors',
        isInList
          ? 'border-white bg-white text-black'
          : 'border-white/25 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
      )}
    >
      {iconContent}
    </motion.button>
  )
}
