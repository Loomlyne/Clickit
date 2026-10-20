// Portrait poster card (2:3). Fills its grid cell; title and meta are always
// visible under the poster so touch screens (no hover) still read the show.
'use client'

import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'

import { WatchlistToggleButton } from '@/components/watchlist/watchlist-toggle-button'
import type { ViewShow } from '@/lib/queries'

interface PortraitShowCardProps {
  show: ViewShow
  initialSaved?: boolean
  userId?: string | null
}

export function PortraitShowCard({
  show,
  initialSaved,
  userId,
}: PortraitShowCardProps) {
  const t = useTranslations('show')

  return (
    <div className="group relative w-full">
      {userId !== undefined && (
        <WatchlistToggleButton
          showId={show.id}
          variant="card"
          initialSaved={initialSaved}
          userId={userId ?? null}
        />
      )}

      <Link href={`/series/${show.slug}`} className="block">
        <div className="relative aspect-[2/3] w-full overflow-hidden rounded-[12px] bg-[var(--bg-2)] transition-transform duration-[250ms] ease-[var(--ease)] group-hover:-translate-y-1">
          {show.posterUrl || show.heroImageUrl ? (
            <Image
              src={(show.posterUrl ?? show.heroImageUrl) as string}
              alt=""
              fill
              sizes="(max-width: 640px) 45vw, 220px"
              className="object-cover transition-transform duration-[400ms] ease-[var(--ease)] group-hover:scale-[1.04]"
            />
          ) : null}

          {show.status === 'streaming' && show.episodeCount <= 3 && (
            <div className="absolute start-2.5 top-2.5 rounded-full bg-[var(--uis-primary-soft)] px-2.5 py-1 text-[11px] font-semibold tracking-[0.08em] text-[var(--primary)] uppercase">
              {t('newBadge')}
            </div>
          )}
        </div>

        <div className="px-0.5 pt-2.5">
          <h3 className="m-0 truncate text-[14px] leading-[1.3] font-medium text-[var(--text)]">
            {show.title}
          </h3>
          <p className="m-0 truncate text-[12px] text-[var(--text-mute)]">
            {show.genre} · {t('seasonCountLabel', { count: show.seasonCount })}
          </p>
        </div>
      </Link>
    </div>
  )
}
