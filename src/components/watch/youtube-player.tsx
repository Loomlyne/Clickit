'use client'

import { useEffect, useRef } from 'react'
import { useLocale, useTranslations } from 'next-intl'

import { loadYouTubeAPI } from '@/lib/youtube'
import { buildPlayerVars } from '@/lib/watch/player-vars'

// ---------------------------------------------------------------------------
// YouTubePlayer component
//
// YouTube required-minimum-functionality (UI-SPEC 3.1): nothing is drawn over
// the player while it is visible, so there is no loading tint and no error
// overlay in here. The watch shell renders the branded error card and hides
// this component with `hidden` while a card shows.
//
// `hidden` sits on a React-owned wrapper. YT.Player REPLACES the element it is
// given with its iframe, so it is given an inner node created by hand inside
// the wrapper; the wrapper and its `hidden` attribute are never touched by
// YouTube, and a hidden iframe really has offsetParent === null.
// ---------------------------------------------------------------------------

interface YouTubePlayerProps {
  videoId: string
  /** Where the video starts, in seconds (playerVars.start). */
  startSeconds?: number
  /** Takes the iframe out of layout (a card replaces it). Stop the video first. */
  hidden?: boolean
  /** @deprecated No loading tint any more; kept so the current shell compiles. */
  brandColor?: string
  onReady?: (player: YT.Player) => void
  onStateChange?: (state: number) => void
  onError?: (errorCode: number) => void
  /** The browser blocked scripted playback (the countdown's loadVideoById). */
  onAutoplayBlocked?: () => void
}

/** The YouTube id the player is on right now, or null when it cannot say. */
export function getPlayerVideoId(player: YT.Player | null | undefined): string | null {
  try {
    return player?.getVideoData?.()?.video_id || null
  } catch {
    return null
  }
}

export function YouTubePlayer({
  videoId,
  startSeconds,
  hidden,
  onReady,
  onStateChange,
  onError,
  onAutoplayBlocked,
}: YouTubePlayerProps) {
  const t = useTranslations('player')
  const locale = useLocale()
  const wrapperRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<YT.Player | null>(null)

  // Store callback props in refs to avoid useEffect re-triggering (Pitfall 5)
  const onReadyRef = useRef(onReady)
  const onStateChangeRef = useRef(onStateChange)
  const onErrorRef = useRef(onError)
  const onAutoplayBlockedRef = useRef(onAutoplayBlocked)
  // The values the player is built from, read once per videoId change.
  const startSecondsRef = useRef(startSeconds)
  const localeRef = useRef(locale)
  // Sync after each render; declared before the player effect so it runs first.
  useEffect(() => {
    onReadyRef.current = onReady
    onStateChangeRef.current = onStateChange
    onErrorRef.current = onError
    onAutoplayBlockedRef.current = onAutoplayBlocked
    startSecondsRef.current = startSeconds
    localeRef.current = locale
  })

  useEffect(() => {
    let cancelled = false
    const wrapper = wrapperRef.current

    async function init() {
      await loadYouTubeAPI()
      if (cancelled || !wrapperRef.current) return

      // YT replaces this node with its iframe; the wrapper stays React's.
      const mount = document.createElement('div')
      wrapperRef.current.appendChild(mount)

      playerRef.current = new YT.Player(mount, {
        videoId,
        width: '100%',
        height: '100%',
        playerVars: buildPlayerVars({
          locale: localeRef.current,
          start: startSecondsRef.current,
          origin: window.location.origin,
        }),
        events: {
          onReady: (event) => {
            if (cancelled) return
            onReadyRef.current?.(event.target)
          },
          onStateChange: (event) => {
            if (cancelled) return
            onStateChangeRef.current?.(event.data)
          },
          onError: (event) => {
            if (cancelled) return
            onErrorRef.current?.(event.data)
          },
          onAutoplayBlocked: () => {
            if (cancelled) return
            onAutoplayBlockedRef.current?.()
          },
        },
      })
    }

    init()

    return () => {
      cancelled = true
      playerRef.current?.destroy()
      playerRef.current = null
      // destroy() removes the iframe; clear anything that is left over.
      wrapper?.replaceChildren()
    }
  }, [videoId])

  return (
    <div
      role="region"
      aria-label={t('videoPlayerAria')}
      className="relative aspect-video min-h-[200px] w-full bg-black"
    >
      <div ref={wrapperRef} hidden={hidden} className="absolute start-0 top-0 size-full" />
    </div>
  )
}
