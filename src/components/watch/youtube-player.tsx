'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Play } from 'lucide-react'

import { cn } from '@/lib/utils'
import { loadYouTubeAPI } from '@/lib/youtube'

// ---------------------------------------------------------------------------
// YouTubePlayer component
// ---------------------------------------------------------------------------

interface YouTubePlayerProps {
  videoId: string
  brandColor?: string // Tailwind bg class for loading state (e.g., 'bg-brand-purple')
  onReady?: (player: YT.Player) => void
  onStateChange?: (state: number) => void
  onError?: (errorCode: number) => void
}

export function YouTubePlayer({
  videoId,
  brandColor,
  onReady,
  onStateChange,
  onError,
}: YouTubePlayerProps) {
  const t = useTranslations('player')
  const containerRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<YT.Player | null>(null)

  // Store callback props in refs to avoid useEffect re-triggering (Pitfall 5)
  const onReadyRef = useRef(onReady)
  const onStateChangeRef = useRef(onStateChange)
  const onErrorRef = useRef(onError)

  useEffect(() => {
    onReadyRef.current = onReady
    onStateChangeRef.current = onStateChange
    onErrorRef.current = onError
  }, [onError, onReady, onStateChange])

  const [readyVideoId, setReadyVideoId] = useState<string | null>(null)
  const [playerError, setPlayerError] = useState<{
    videoId: string
    code: number
  } | null>(null)
  const isReady = readyVideoId === videoId
  const errorCode = playerError?.videoId === videoId ? playerError.code : null

  useEffect(() => {
    let cancelled = false

    async function init() {
      await loadYouTubeAPI()
      if (cancelled || !containerRef.current) return

      playerRef.current = new YT.Player(containerRef.current, {
        videoId,
        playerVars: {
          autoplay: 0,
          controls: 1,
          rel: 0,
          playsinline: 1,
          enablejsapi: 1,
          iv_load_policy: 3,
          origin: window.location.origin,
        },
        events: {
          onReady: (event) => {
            if (cancelled) return
            setReadyVideoId(videoId)
            onReadyRef.current?.(event.target)
          },
          onStateChange: (event) => {
            if (cancelled) return
            onStateChangeRef.current?.(event.data)
          },
          onError: (event) => {
            if (cancelled) return
            setPlayerError({ videoId, code: event.data })
            onErrorRef.current?.(event.data)
          },
        },
      })
    }

    init()

    return () => {
      cancelled = true
      playerRef.current?.destroy()
      playerRef.current = null
    }
  }, [videoId])

  // Error message content
  function getErrorMessage(code: number): string {
    if (code === 101 || code === 150) {
      return t('errorVideoUnavailableRetry')
    }
    if (code === 100) {
      return t('errorVideoNotFound')
    }
    return t('errorPlayerRefresh')
  }

  return (
    <div
      role="region"
      aria-label={t('videoPlayerAria')}
      className="relative aspect-video min-h-[200px] w-full bg-black"
    >
      {/* Loading state — absolute overlay */}
      {!isReady && !errorCode && (
        <div
          className={cn(
            'absolute inset-0 z-10 flex items-center justify-center',
            brandColor ?? 'bg-surface-2'
          )}
        >
          <Play className="size-12 text-white/20" aria-hidden="true" />
        </div>
      )}

      {/* Error state — absolute overlay */}
      {errorCode !== null && (
        <div
          className="bg-surface-2 absolute inset-0 z-10 flex items-center justify-center px-6"
          role="alert"
        >
          <p className="text-muted-foreground text-center text-sm">
            {getErrorMessage(errorCode)}
          </p>
        </div>
      )}

      {/* Player container — always visible with full dimensions so iframe can initialize */}
      <div ref={containerRef} className="absolute inset-0 h-full w-full" />
    </div>
  )
}
