import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { ShowArt } from '@/components/primitives/show-art'
import type { RecentlyWatchedItem } from '@/lib/queries'
import { BRAND_COLOR_HEX } from '@/lib/brand-colors'

interface ProfileHistoryRowProps {
  item: RecentlyWatchedItem
}

export async function ProfileHistoryRow({ item }: ProfileHistoryRowProps) {
  const brandHex = BRAND_COLOR_HEX[item.showBrandColor] ?? BRAND_COLOR_HEX['brand-blue']
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
      className="grid min-h-16 grid-cols-[5rem_1fr] items-center gap-x-4 gap-y-2 rounded-xl px-3 py-3 transition-colors hover:bg-[var(--bg-2)] sm:grid-cols-[5rem_1fr_7.5rem]"
    >
      {/* Thumbnail */}
      <div className="aspect-video w-20 flex-shrink-0 overflow-hidden rounded-lg">
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
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-[var(--text)]">
          {item.episodeTitle}
        </p>
        <p className="mt-0.5 text-xs text-[var(--text-mute)]">
          {item.showTitle} &middot; S{item.seasonNumber} E{item.episodeNumber}
        </p>
      </div>

      {/* Status: under the text on a phone, own column from sm up */}
      <div className="col-start-2 sm:col-start-3">
        {item.completed ? (
          <span className="inline-block rounded-full bg-[var(--bg-3)] px-2.5 py-1 text-xs text-[var(--text-dim)]">
            {t('historyCompleted')}
          </span>
        ) : (
          <div
            role="progressbar"
            aria-label={item.episodeTitle}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progressPercent}
            className="w-full"
          >
            <div className="h-1.5 overflow-hidden rounded-full bg-[var(--bg-4)]">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${progressPercent}%`,
                  backgroundColor: brandHex,
                }}
              />
            </div>
            <p className="mt-1 text-xs text-[var(--text-mute)] sm:text-end">
              {t('progressLabel', { percent: progressPercent })}
            </p>
          </div>
        )}
      </div>
    </Link>
  )
}
