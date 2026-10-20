'use client'

import { useState, useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'

import { Tr } from '@/components/i18n/tr'

interface AutoplayOverlayProps {
  nextEpisode: {
    id: string
    title: string
    seasonNumber: number
    episodeNumber: number
  }
  onPlayNow: () => void
  onCancel: () => void
}

export function AutoplayOverlay({
  nextEpisode,
  onPlayNow,
  onCancel,
}: AutoplayOverlayProps) {
  const t = useTranslations('player')
  const [countdown, setCountdown] = useState(8)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current)
          onPlayNow()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [onPlayNow])

  return (
    <div className="absolute inset-0 z-20 flex items-end justify-between bg-gradient-to-t from-black/90 via-black/50 to-transparent p-4 max-sm:flex-col max-sm:items-stretch max-sm:gap-4 md:p-6">
      {/* Left column - next episode info */}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium tracking-widest text-[var(--text-mute)] uppercase">
          {t('nextEpisode')}
        </span>
        <span className="text-sm text-[var(--text-dim)]">
          <Tr
            k="seasonEpisodeShort"
            values={{
              season: nextEpisode.seasonNumber,
              episode: nextEpisode.episodeNumber,
            }}
          />
        </span>
        <span className="text-lg font-semibold text-white">
          {nextEpisode.title}
        </span>
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs text-[var(--text-dim)]">
          {t('autoplayCountdown', { seconds: countdown })}
        </span>
      </div>

      {/* Right column - action buttons */}
      <div className="flex flex-col items-end gap-2 max-sm:w-full max-sm:flex-row max-sm:items-stretch">
        <button
          onClick={onPlayNow}
          className="min-h-11 rounded-full bg-[var(--primary)] px-6 text-sm font-semibold text-[var(--primary-foreground)] transition-colors duration-200 hover:bg-white max-sm:flex-1"
        >
          {t('autoplayPlayNow')}
        </button>
        <button
          onClick={() => {
            if (intervalRef.current) clearInterval(intervalRef.current)
            onCancel()
          }}
          className="min-h-11 rounded-full border border-[var(--line-2)] px-4 text-sm text-[var(--text)] transition-all duration-200 hover:bg-white/[0.06] max-sm:flex-1"
        >
          {t('autoplayCancelButton')}
        </button>
      </div>
    </div>
  )
}
