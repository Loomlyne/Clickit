import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { ShowArt } from '@/components/primitives/show-art'
import type { RecentlyWatchedItem } from '@/lib/queries'
import { BRAND_COLOR_HEX } from '@/lib/brand-colors'

interface ProfileHistoryRowProps {
  item: RecentlyWatchedItem
}

export async function ProfileHistoryRow({ item }: ProfileHistoryRowProps) {
  const brandHex = BRAND_COLOR_HEX[item.showBrandColor] ?? '#2C3569'
  const progressPercent =
    item.durationSeconds > 0
      ? Math.min(
          Math.round((item.progressSeconds / item.durationSeconds) * 100),
          100
        )
      : 0
  const t = await getTranslations('profile')

  return (
    <Link
      href={`/watch/${item.episodeId}`}
      className="-mx-2 flex items-center gap-4 rounded-full border-b border-[var(--line)] px-2 py-3 transition-colors last:border-0 hover:bg-[var(--bg-2)]"
    >
      {/* Thumbnail */}
      <div className="aspect-video w-20 flex-shrink-0 overflow-hidden rounded-[8px]">
        <ShowArt
          brandColor={brandHex}
          title={item.episodeTitle}
          aspectRatio="16/9"
        >
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-lg font-black text-white/30">
              E{item.episodeNumber}
            </span>
          </div>
        </ShowArt>
      </div>

      {/* Text */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-white">
          {item.episodeTitle}
        </p>
        <p className="mt-0.5 text-xs text-[var(--text-mute)]">
          {item.showTitle} &middot; S{item.seasonNumber} E{item.episodeNumber}
        </p>
      </div>

      {/* Status */}
      <div className="flex-shrink-0">
        {item.completed ? (
          <span className="rounded-full bg-[var(--bg-3)] px-2.5 py-1 text-xs text-[var(--text-dim)]">
            {t('historyCompleted')}
          </span>
        ) : (
          <div className="w-20">
            <div className="h-1.5 overflow-hidden rounded-full bg-[var(--bg-4)]">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${progressPercent}%`,
                  backgroundColor: brandHex,
                }}
              />
            </div>
            <p className="mt-1 text-end font-mono text-[11px] text-[var(--text-mute)]">
              {progressPercent}%
            </p>
          </div>
        )}
      </div>
    </Link>
  )
}
