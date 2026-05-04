// Poster card — matches handoff .poster (landscape variant)
// Sharp 6px radius, solid bg, hover overlay with title/meta/play
import { Link } from '@/i18n/navigation'
import { Play, Plus } from 'lucide-react'

import type { ViewShow } from '@/lib/queries'

interface ShowCardProps {
  show: ViewShow
}

export function ShowCard({ show }: ShowCardProps) {
  return (
    <Link
      href={`/series/${show.slug}`}
      className="poster group relative block flex-shrink-0 cursor-pointer overflow-hidden rounded-[24px] bg-[var(--bg-2)] transition-transform duration-[250ms] ease-[var(--ease)] hover:-translate-y-1 hover:z-[2]"
      style={{ width: 'var(--landscape-w)', aspectRatio: '16 / 9' }}
    >
      {show.heroImageUrl || show.posterUrl ? (
        <img
          src={show.heroImageUrl ?? show.posterUrl}
          alt={show.title}
          className="h-full w-full object-cover transition-transform duration-[400ms] ease-[var(--ease)] group-hover:scale-[1.04]"
        />
      ) : (
        <div className="h-full w-full bg-[var(--bg-2)]" />
      )}

      {/* Hover overlay */}
      <div className="poster-overlay absolute inset-0 flex flex-col justify-end bg-gradient-to-b from-transparent from-[40%] to-[rgba(0,0,0,0.85)] p-3.5 opacity-0 transition-opacity duration-200 ease-[var(--ease)] group-hover:opacity-100">
        <h3 className="font-display m-0 mb-0.5 text-[18px] leading-[1.1]">
          {show.title}
        </h3>
        <div className="mono text-[10.5px]">
          {show.genre} · {show.seasonCount} season{show.seasonCount !== 1 ? 's' : ''} · {show.episodeCount} eps
        </div>
        <div className="mt-2.5 flex gap-1.5">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-[7px] text-[12.5px] font-medium text-primary-foreground">
            <Play className="size-3 fill-current" /> Play
          </span>
          <span className="inline-flex items-center rounded-full border border-[var(--line-2)] bg-[rgba(10,10,10,0.5)] px-3 py-[7px] text-[12.5px] font-medium">
            <Plus className="size-3" />
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
  )
}
