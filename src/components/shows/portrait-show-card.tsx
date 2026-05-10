// Portrait poster card — matches handoff .poster (vertical 2:3)
'use client'

import { useLocale } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { Play } from 'lucide-react'

import { WatchlistToggleButton } from '@/components/watchlist/watchlist-toggle-button'
import type { ViewShow } from '@/lib/queries'

interface PortraitShowCardProps {
  show: ViewShow
  initialSaved?: boolean
  userId?: string | null
}

export function PortraitShowCard({ show, initialSaved, userId }: PortraitShowCardProps) {
  const locale = useLocale()
  const isArabic = locale === 'ar'

  return (
    <div className="group relative">
      {userId !== undefined && (
        <WatchlistToggleButton
          showId={show.id}
          variant="card"
          initialSaved={initialSaved}
          userId={userId ?? null}
        />
      )}

      <Link
        href={`/series/${show.slug}`}
        className="poster relative block flex-shrink-0 cursor-pointer overflow-hidden rounded-[24px] bg-[var(--bg-2)] transition-transform duration-[250ms] ease-[var(--ease)] group-hover:-translate-y-1 group-hover:z-[2]"
        style={{ width: 'var(--poster-w)', aspectRatio: '2 / 3' }}
      >
        {show.posterUrl || show.heroImageUrl ? (
          <img
            src={show.posterUrl ?? show.heroImageUrl}
            alt={show.title}
            className="h-full w-full object-cover transition-transform duration-[400ms] ease-[var(--ease)] group-hover:scale-[1.04]"
          />
        ) : (
          <div className="h-full w-full bg-[var(--bg-2)]" />
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-b from-transparent from-[40%] to-[rgba(0,0,0,0.85)] p-3.5 opacity-0 transition-opacity duration-200 ease-[var(--ease)] group-hover:opacity-100">
          <h3 className="font-display m-0 mb-0.5 text-[20px] leading-[1.1]">
            {show.title}
          </h3>
          <div className="mono text-[10.5px]">
            {show.genre} · {show.seasonCount} {isArabic
              ? (show.seasonCount === 1 ? 'موسم' : 'مواسم')
              : (show.seasonCount === 1 ? 'season' : 'seasons')}
          </div>
          <div className="mt-2.5 flex gap-1.5">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-[7px] text-[12.5px] font-medium text-primary-foreground">
              <Play className="size-3 fill-current" /> Play
            </span>
          </div>
        </div>

        {/* New badge */}
        {show.status === 'streaming' && show.episodeCount <= 3 && (
          <div className="absolute left-2.5 top-2.5 rounded-full bg-primary px-2 py-1 font-[family-name:var(--font-mono)] text-[9.5px] font-semibold uppercase tracking-[0.14em] text-primary-foreground">
            New
          </div>
        )}
      </Link>
    </div>
  )
}
