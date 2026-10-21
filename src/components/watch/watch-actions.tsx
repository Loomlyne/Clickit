'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Bookmark, Check, Heart, Share2 } from 'lucide-react'

import { useLikes } from '@/hooks/use-likes'
import { useWatchlist } from '@/hooks/use-watchlist'
import { isolate } from '@/lib/i18n-format'
import { cn } from '@/lib/utils'

/** How long an announcement stays in the live region. */
const ANNOUNCE_CLEAR_MS = 3000
/** How long the Share button shows its Check icon after a copy. */
const SHARE_CONFIRM_MS = 2000

/**
 * The watch route has no Toaster (UI-SPEC 3.1), so feedback goes to one
 * visually hidden polite live region. The shell renders `node` once and passes
 * `announce` to every WatchActions instance.
 */
export function useWatchAnnouncer() {
  const [text, setText] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const announce = useCallback((message: string) => {
    if (timer.current) clearTimeout(timer.current)
    setText(message)
    timer.current = setTimeout(() => setText(''), ANNOUNCE_CLEAR_MS)
  }, [])

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    []
  )

  const node = (
    <span aria-live="polite" className="sr-only">
      {text}
    </span>
  )

  return { announce, node }
}

export type WatchAction = 'watchlist' | 'like' | 'share'

type WatchActionsProps = {
  showId: string
  showTitle: string
  userId: string | null
  initialSaved: boolean
  initialLiked: boolean
  /**
   * 'top'        desktop top bar: Watchlist and Like only from md up, Share always
   * 'season-row' phone season row: Watchlist and Like, phones only, at the end
   */
  variant: 'top' | 'season-row'
  include: WatchAction[]
  announce: (message: string) => void
}

const BUTTON_CLASS =
  'flex size-11 shrink-0 items-center justify-center rounded-full text-[var(--text-dim)] transition-colors duration-150 hover:text-[var(--text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-0)]'

export function WatchActions({
  showId,
  showTitle,
  userId,
  initialSaved,
  initialLiked,
  variant,
  include,
  announce,
}: WatchActionsProps) {
  const t = useTranslations('watch')
  const name = isolate(showTitle)

  const { isInList, toggle: toggleWatchlist } = useWatchlist(
    showId,
    initialSaved,
    userId,
    { onError: announce }
  )
  const { isLiked, toggle: toggleLike } = useLikes(showId, initialLiked, userId, {
    onError: announce,
  })

  const [copied, setCopied] = useState(false)
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (copiedTimer.current) clearTimeout(copiedTimer.current)
    },
    []
  )

  function handleShare() {
    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator.share({ url: window.location.href }).catch(() => {
        /* viewer dismissed the share sheet */
      })
      return
    }
    navigator.clipboard
      .writeText(window.location.href)
      .then(() => {
        setCopied(true)
        announce(t('linkCopied'))
        if (copiedTimer.current) clearTimeout(copiedTimer.current)
        copiedTimer.current = setTimeout(() => setCopied(false), SHARE_CONFIRM_MS)
      })
      .catch(() => {
        /* clipboard blocked: nothing to confirm */
      })
  }

  const inTop = variant === 'top'

  return (
    <div
      className={cn(
        'flex items-center gap-1',
        !inTop && 'ms-auto md:hidden'
      )}
    >
      {include.includes('watchlist') && (
        <button
          type="button"
          onClick={toggleWatchlist}
          className={cn(BUTTON_CLASS, inTop && 'max-md:hidden')}
          aria-label={
            isInList
              ? t('removeFromWatchlist', { title: name })
              : t('addToWatchlist', { title: name })
          }
          aria-pressed={isInList}
        >
          <Bookmark
            className={cn(
              'size-5',
              isInList && 'fill-[var(--primary)] text-[var(--primary)]'
            )}
          />
        </button>
      )}
      {include.includes('like') && (
        <button
          type="button"
          onClick={toggleLike}
          className={cn(BUTTON_CLASS, inTop && 'max-md:hidden')}
          aria-label={
            isLiked
              ? t('unlikeShow', { title: name })
              : t('likeShow', { title: name })
          }
          aria-pressed={isLiked}
        >
          <Heart
            className={cn(
              'size-5',
              isLiked && 'fill-[var(--primary)] text-[var(--primary)]'
            )}
          />
        </button>
      )}
      {include.includes('share') && (
        <button
          type="button"
          onClick={handleShare}
          className={BUTTON_CLASS}
          aria-label={copied ? t('linkCopied') : t('shareEpisode', { title: name })}
        >
          {copied ? (
            <Check className="size-5" />
          ) : (
            <Share2 className="size-5" />
          )}
        </button>
      )}
    </div>
  )
}
