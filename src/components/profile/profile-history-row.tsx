import { getLocale } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { ShowArt } from '@/components/primitives/show-art'
import type { RecentlyWatchedItem } from '@/lib/queries'
import { BRAND_COLOR_HEX } from '@/lib/brand-colors'

interface ProfileHistoryRowProps {
  item: RecentlyWatchedItem
}

export async function ProfileHistoryRow({ item }: ProfileHistoryRowProps) {
  const brandHex = BRAND_COLOR_HEX[item.showBrandColor] ?? '#2C3569'
  const progressPercent = item.durationSeconds > 0
    ? Math.min(Math.round((item.progressSeconds / item.durationSeconds) * 100), 100)
    : 0
  const locale = await getLocale()
  const isArabic = locale === 'ar'

  return (
    <Link
      href={`/watch/${item.episodeId}`}
      className="flex items-center gap-4 py-3 border-b border-[var(--line)] last:border-0 hover:bg-[var(--bg-2)] transition-colors rounded-[4px] px-2 -mx-2"
    >
      {/* Thumbnail */}
      <div className="w-20 aspect-video rounded-[4px] overflow-hidden flex-shrink-0">
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
        <p className="text-xs text-[var(--text-mute)] mt-0.5">
          {item.showTitle} &middot; S{item.seasonNumber} E{item.episodeNumber}
        </p>
      </div>

      {/* Status */}
      <div className="flex-shrink-0">
        {item.completed ? (
          <span className="rounded-[4px] bg-[var(--bg-3)] px-2.5 py-1 text-xs text-[var(--text-dim)]">
            {isArabic ? 'مُكتمل' : 'Completed'}
          </span>
        ) : (
          <div className="w-20">
            <div className="h-1.5 rounded-[2px] bg-[var(--bg-4)] overflow-hidden">
              <div
                className="h-full rounded-[2px]"
                style={{ width: `${progressPercent}%`, backgroundColor: brandHex }}
              />
            </div>
            <p className="font-mono text-[11px] text-[var(--text-mute)] mt-1 text-end">{progressPercent}%</p>
          </div>
        )}
      </div>
    </Link>
  )
}
