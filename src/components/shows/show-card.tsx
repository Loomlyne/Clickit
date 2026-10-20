// Poster card — matches handoff .poster (landscape variant)
// Sharp 6px radius, solid bg, hover overlay with title/meta/play
import Image from 'next/image'
import { Link } from '@/i18n/navigation'
import { Play } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Tr } from '@/components/i18n/tr'

import type { ViewShow } from '@/lib/queries'

interface ShowCardProps {
  show: ViewShow
}

export function ShowCard({ show }: ShowCardProps) {
  const t = useTranslations('show')
  const imgSrc = show.cardImageUrl ?? show.heroImageUrl ?? show.posterUrl
  return (
    <Link
      href={`/series/${show.slug}`}
      className="poster group relative block flex-shrink-0 cursor-pointer overflow-hidden rounded-[12px] bg-[var(--bg-2)] transition-transform duration-[250ms] ease-[var(--ease)] hover:z-[2] hover:-translate-y-1"
      style={{ width: 'var(--landscape-w)', aspectRatio: '16 / 9' }}
    >
      {imgSrc ? (
        <Image
          src={imgSrc}
          alt={show.title}
          fill
          sizes="(max-width: 640px) 80vw, 320px"
          className="object-cover transition-transform duration-[400ms] ease-[var(--ease)] group-hover:scale-[1.04]"
        />
      ) : (
        <div className="h-full w-full bg-[var(--bg-2)]" />
      )}

      {/* Hover overlay */}
      <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-b from-transparent from-[40%] to-[rgba(0,0,0,0.85)] p-3.5 transition-opacity duration-200 ease-[var(--ease)] sm:opacity-0 sm:group-hover:opacity-100">
        <h3 className="font-display m-0 mb-0.5 text-[18px] leading-[1.1]">
          {show.title}
        </h3>
        <div className="mono">
          {show.genre} · {t('seasonCountLabel', { count: show.seasonCount })} ·{' '}
          {t('episodeCountLabel', { count: show.episodeCount })}
        </div>
        <div className="mt-2.5 flex gap-1.5">
          <span className="bg-primary text-primary-foreground inline-flex items-center gap-1.5 rounded-full px-3 py-[7px] text-[12.5px] font-medium">
            <Play className="size-3 fill-current" /> <Tr k="play" />
          </span>
        </div>
      </div>

      {/* New badge */}
      {show.status === 'streaming' && show.episodeCount <= 3 && (
        <div className="absolute start-2.5 top-2.5 rounded-full bg-[var(--uis-primary-soft)] px-2.5 py-1 text-[11px] font-semibold tracking-[0.08em] text-[var(--primary)] uppercase">
          <Tr k="newBadge" />
        </div>
      )}
    </Link>
  )
}
