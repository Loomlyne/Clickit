import { Link } from '@/i18n/navigation'
import { ShowArt } from '@/components/primitives/show-art'
import type { RecentlyWatchedItem } from '@/lib/queries'
import { BRAND_COLOR_HEX } from '@/lib/brand-colors'

interface ProfileHistoryRowProps {
  item: RecentlyWatchedItem
}

export function ProfileHistoryRow({ item }: ProfileHistoryRowProps) {
  const brandHex = BRAND_COLOR_HEX[item.showBrandColor] ?? '#2C3569'
  const progressPercent = item.durationSeconds > 0
    ? Math.min(Math.round((item.progressSeconds / item.durationSeconds) * 100), 100)
    : 0

  return (
    <Link
      href={`/watch/${item.episodeId}`}
      className="flex items-center gap-4 py-3 border-b border-white/[0.06] last:border-0 hover:bg-white/[0.02] transition-colors rounded-lg px-2 -mx-2"
    >
      {/* Thumbnail */}
      <div className="w-20 aspect-video rounded-lg overflow-hidden flex-shrink-0">
        <ShowArt brandColor={brandHex} title={item.episodeTitle} aspectRatio="16/9">
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-lg font-black text-white/30">
              E{item.episodeNumber}
            </span>
          </div>
        </ShowArt>
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white truncate">{item.episodeTitle}</p>
        <p className="text-xs text-white/50 mt-0.5">
          {item.showTitle} &middot; S{item.seasonNumber} E{item.episodeNumber}
        </p>
      </div>

      {/* Status */}
      <div className="flex-shrink-0">
        {item.completed ? (
          <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs text-white/60">
            Completed
          </span>
        ) : (
          <div className="w-20">
            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{ width: `${progressPercent}%`, backgroundColor: brandHex }}
              />
            </div>
            <p className="text-[11px] text-white/40 mt-1 text-end">{progressPercent}%</p>
          </div>
        )}
      </div>
    </Link>
  )
}
