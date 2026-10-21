import { CircleAlert } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'

import { Link } from '@/i18n/navigation'
import { AdminPanel } from '@/components/admin/admin-shell'
import { YouTubeStatusChip } from '@/components/admin/youtube-status-chip'
import type {
  CantPlayReason,
  YouTubeHealthSummary,
} from '@/lib/admin/youtube-health'
import { localeTag } from '@/lib/i18n-format'

// UI-SPEC 5.5 (D-17): the dashboard "YouTube check" panel. Flag only: it
// lists what cannot play and links to the show; no episode is changed
// from here. Server-renderable (no state, no effects).

const STATUS_TEXT_KEY = {
  private: 'private',
  removed: 'removed',
  not_embeddable: 'notEmbeddable',
  blocked_ae: 'blockedUae',
  not_ready: 'notReady',
} as const

export function YouTubeCheckPanel({
  summary,
}: {
  summary: YouTubeHealthSummary
}) {
  const locale = useLocale()
  const t = useTranslations('admin.dashboard')
  const tStatus = useTranslations('admin.youtubeStatus')
  const tTable = useTranslations('admin.episodesTable')
  const tShow = useTranslations('show')

  // The check runs on UAE time, so its time is shown in it.
  const lastCheck = summary.lastCheckedAt
    ? new Intl.DateTimeFormat(localeTag(locale), {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Dubai',
      }).format(new Date(summary.lastCheckedAt))
    : null

  const reasonText = (reason: CantPlayReason) =>
    reason === 'viewer_report'
      ? tTable('cantPlayViewerReport')
      : tStatus(STATUS_TEXT_KEY[reason])

  const hiddenCount = summary.cantPlayTotal - summary.cantPlay.length

  return (
    <AdminPanel>
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-[11px] font-semibold tracking-[0.12em] text-[var(--text-mute)] uppercase">
          {t('youtubeCheckTitle')}
        </h2>
        <div className="flex items-center gap-2">
          {lastCheck && (
            <span className="text-[11px] text-[var(--text-mute)]">
              {t('lastCheck', { date: lastCheck })}
            </span>
          )}
          {summary.overdue && (
            <YouTubeStatusChip tone="warn">
              {t('checkOverdue')}
            </YouTubeStatusChip>
          )}
        </div>
      </div>

      <div className="mt-3">
        {summary.cantPlayTotal > 0 ? (
          <>
            <YouTubeStatusChip
              tone="bad"
              icon={<CircleAlert className="size-4" />}
            >
              {t('cantPlayCount', { count: summary.cantPlayTotal })}
            </YouTubeStatusChip>
            <ul className="mt-3 divide-y divide-[var(--line)]">
              {summary.cantPlay.map((entry) => (
                <li key={entry.id}>
                  <Link
                    href={`/admin/shows/${entry.showId}`}
                    className="flex min-h-11 items-center justify-between gap-3 text-sm text-[var(--text)] hover:text-[var(--text-dim)]"
                  >
                    <span className="min-w-0">
                      <bdi className="truncate">{entry.showTitle}</bdi>
                      {' · '}
                      {entry.seasonNumber === null
                        ? tShow('episodeShort', {
                            episode: entry.episodeNumber,
                          })
                        : tShow('seasonEpisodeShort', {
                            season: entry.seasonNumber,
                            episode: entry.episodeNumber,
                          })}
                    </span>
                    <YouTubeStatusChip tone="bad">
                      {reasonText(entry.reason)}
                    </YouTubeStatusChip>
                  </Link>
                </li>
              ))}
            </ul>
            {hiddenCount > 0 && (
              <p className="mt-2 text-sm text-[var(--text-mute)]">
                {t('cantPlayMore', { count: hiddenCount })}
              </p>
            )}
          </>
        ) : summary.neverChecked ? (
          <div className="flex flex-wrap items-center gap-2">
            <YouTubeStatusChip tone="neutral">
              {t('notCheckedChip')}
            </YouTubeStatusChip>
            <span className="text-sm text-[var(--text-dim)]">
              {t('notCheckedBody')}
            </span>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <YouTubeStatusChip tone="ok">{t('allPlay')}</YouTubeStatusChip>
            <span className="text-sm text-[var(--text-dim)]">
              {t('allPlayBody')}
            </span>
          </div>
        )}
      </div>
    </AdminPanel>
  )
}
