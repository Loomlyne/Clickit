// Episode poster card — matches handoff .poster (landscape)
import Image from 'next/image'
import { Link } from '@/i18n/navigation'
import { Play } from 'lucide-react'
import { Tr } from '@/components/i18n/tr'

import type { NewEpisodeItem } from '@/lib/queries'

interface EpisodeCardProps {
  episode: NewEpisodeItem
}

export function EpisodeCard({ episode }: EpisodeCardProps) {
  const thumbnailUrl = episode.youtubeId
    ? `https://img.youtube.com/vi/${episode.youtubeId}/hqdefault.jpg`
    : episode.showPosterUrl

  return (
    <Link
      href={`/watch/${episode.id}`}
      className="poster group relative block flex-shrink-0 cursor-pointer overflow-hidden rounded-[12px] bg-[var(--bg-2)] transition-transform duration-[250ms] ease-[var(--ease)] hover:z-[2] hover:-translate-y-1"
      style={{ width: 'var(--landscape-w)', aspectRatio: '16 / 9' }}
    >
      {thumbnailUrl ? (
        <Image
          src={thumbnailUrl as string}
          alt={episode.title}
          fill
          sizes="(max-width: 640px) 80vw, 320px"
          className="object-cover transition-transform duration-[400ms] ease-[var(--ease)] group-hover:scale-[1.04]"
        />
      ) : (
        <div className="h-full w-full bg-[var(--bg-2)]" />
      )}

      {/* Hover overlay */}
      <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-b from-transparent from-[40%] to-[rgba(0,0,0,0.85)] p-3.5 opacity-0 transition-opacity duration-200 ease-[var(--ease)] group-hover:opacity-100">
        <h3 className="font-display m-0 mb-0.5 text-[18px] leading-[1.1]">
          {episode.title}
        </h3>
        <div className="mono text-[10.5px]">
          {episode.showTitle} · E{episode.episodeNumber}
        </div>
        <div className="mt-2.5 flex gap-1.5">
          <span className="bg-primary text-primary-foreground inline-flex items-center gap-1.5 rounded-full px-3 py-[7px] text-[12.5px] font-medium">
            <Play className="size-3 fill-current" /> <Tr k="play" />
          </span>
        </div>
      </div>

      {/* New badge */}
      <div className="bg-primary text-primary-foreground absolute top-2.5 left-2.5 rounded-full px-2 py-1 font-[family-name:var(--font-mono)] text-[9.5px] font-semibold tracking-[0.14em] uppercase">
        <Tr k="newBadge" />
      </div>
    </Link>
  )
}
