// Server component — hover/tap animations moved to CSS (see className below).
// The old motion.div version pulled motion/react into the bundle for every show
// card on the homepage. This one renders on the server and ships zero JS for
// the card itself. Interaction still feels the same — translate + scale with a
// 300ms cubic-bezier easing.
import { Link } from '@/i18n/navigation'
import { Play } from 'lucide-react'

import { ShowArt } from '@/components/primitives/show-art'
import type { ViewShow } from '@/lib/queries'
import { BRAND_COLOR_HEX } from '@/lib/brand-colors'

interface ShowCardProps {
  show: ViewShow
}

export function ShowCard({ show }: ShowCardProps) {
  const rating = show.platformRating ?? show.imdbRating ?? null
  const brandColorHex = BRAND_COLOR_HEX[show.brandColor]

  return (
    <Link href={`/series/${show.slug}`} className="group block cursor-pointer">
      <div
        className="overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.03] shadow-[0_24px_80px_rgba(0,0,0,0.38)] transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform group-hover:-translate-y-1 group-active:translate-y-0 group-active:scale-[0.97]"
      >
        <ShowArt brandColor={brandColorHex} title={show.title} aspectRatio="16/9" className="rounded-none" imageUrl={show.heroImageUrl ?? show.posterUrl}>
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/32 to-transparent" />
          <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/16 bg-[rgba(8,11,18,0.76)] backdrop-blur-sm ring-1 ring-white/8 transition-transform duration-300 group-hover:scale-110">
              <Play className="size-5 fill-white text-white translate-x-0.5" />
            </div>
          </div>
        </ShowArt>
        <div className="space-y-2 px-4 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-display mt-1 truncate text-[17px] font-semibold tracking-[-0.02em] text-white">
                {show.title}
              </h3>
            </div>
            {rating !== null && (
              <span className="mono rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-white/62">
                ★ {rating}
              </span>
            )}
          </div>
          <p className="line-clamp-2 text-sm leading-6 text-white/52">{show.description}</p>
        </div>
        <div
          className="h-[2px] w-full opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{ background: brandColorHex, boxShadow: `0 0 20px 2px ${brandColorHex}50` }}
        />
      </div>
    </Link>
  )
}
