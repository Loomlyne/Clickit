// Continue watching poster — landscape with progress bar
import { Link } from '@/i18n/navigation'
import { Play } from 'lucide-react'

import type { ContinueWatchingItem } from '@/lib/queries'

interface ContinueWatchingCardProps {
  item: ContinueWatchingItem
}

export function ContinueWatchingCard({ item }: ContinueWatchingCardProps) {
  const thumbnailUrl = item.youtubeVideoId
    ? `https://img.youtube.com/vi/${item.youtubeVideoId}/hqdefault.jpg`
    : null

  return (
    <Link
      href={`/watch/${item.episodeId}`}
      className="poster group relative block flex-shrink-0 cursor-pointer overflow-hidden rounded-[24px] bg-[var(--bg-2)] transition-transform duration-[250ms] ease-[var(--ease)] hover:-translate-y-1 hover:z-[2]"
      style={{ width: 'var(--landscape-w)', aspectRatio: '16 / 9' }}
    >
      {thumbnailUrl ? (
        <img
          src={thumbnailUrl}
          alt={item.episodeTitle}
          className="h-full w-full object-cover transition-transform duration-[400ms] ease-[var(--ease)] group-hover:scale-[1.04]"
        />
      ) : (
        <div className="h-full w-full bg-[var(--bg-2)]" />
      )}

      {/* Hover overlay */}
      <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-b from-transparent from-[40%] to-[rgba(0,0,0,0.85)] p-3.5 opacity-0 transition-opacity duration-200 ease-[var(--ease)] group-hover:opacity-100">
        <h3 className="font-display m-0 mb-0.5 text-[18px] leading-[1.1]">
          {item.episodeTitle}
        </h3>
        <div className="mono text-[10.5px]">
          {item.showTitle} · S{item.seasonNumber} E{item.episodeNumber}
        </div>
        <div className="mt-2.5 flex gap-1.5">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-[7px] text-[12.5px] font-medium text-primary-foreground">
            <Play className="size-3 fill-current" /> Continue
          </span>
        </div>
      </div>

      {/* Progress bar */}
      {item.progressPercent > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-white/12">
          <span
            className="block h-full bg-primary"
            style={{ width: `${item.progressPercent}%` }}
          />
        </div>
      )}
    </Link>
  )
}
