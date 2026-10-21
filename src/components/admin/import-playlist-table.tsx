'use client'

import Image from 'next/image'
import { useTranslations } from 'next-intl'

import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { YouTubeStatusChip } from '@/components/admin/youtube-status-chip'
import { isolate } from '@/lib/i18n-format'
import {
  importRowView,
  type ImportTableRow,
} from '@/lib/admin/import-row-view'
import { cn } from '@/lib/utils'

// UI-SPEC 1.6-1.7: the import preview table. Presentational only; the sheet
// (06-17) owns the ticks, the reading state and the mapping from the server's
// PreviewRow onto ImportTableRow.

type ImportPlaylistTableProps = {
  rows: ImportTableRow[]
  /** Video ids the admin has ticked. Only Ready rows can ever count. */
  ticked: Set<string>
  onToggle: (videoId: string) => void
  /** Header checkbox: ticks every Ready row, or clears them when all are ticked. */
  onToggleAllReady: () => void
  /** Skeleton rows shown at the end while pages are still being read. */
  skeletonRows: number
  /** True while importing: every checkbox and row click is inert. */
  disabled: boolean
  locale: string
}

const HEAD = 'h-11 px-2 text-[11px] font-normal tracking-[0.14em]'
const CELL = 'px-2 py-0 align-middle'

export function ImportPlaylistTable({
  rows,
  ticked,
  onToggle,
  onToggleAllReady,
  skeletonRows,
  disabled,
  locale,
}: ImportPlaylistTableProps) {
  const t = useTranslations('admin.youtubeImport')
  const tStatus = useTranslations('admin.youtubeStatus')
  const numbers = new Intl.NumberFormat(locale)

  const views = rows.map((row) => importRowView(row, locale))
  const readyCount = views.filter((v) => v.tickable).length
  const tickedReady = rows.filter(
    (row, i) => views[i].tickable && ticked.has(row.videoId)
  ).length
  const headerChecked: boolean | 'indeterminate' =
    readyCount > 0 && tickedReady === readyCount
      ? true
      : tickedReady > 0
        ? 'indeterminate'
        : false

  return (
    <div className="overflow-hidden rounded-card border border-[var(--line)]">
      <Table aria-busy={skeletonRows > 0} className="table-fixed">
        <TableHeader>
          <TableRow className="sticky top-0 z-[1] h-11 bg-[var(--bg-2)] hover:bg-[var(--bg-2)]">
            <TableHead className={cn(HEAD, 'w-11 p-0')}>
              <label className="flex size-11 items-center justify-center">
                <Checkbox
                  checked={headerChecked}
                  disabled={disabled || readyCount === 0}
                  onCheckedChange={() => onToggleAllReady()}
                  aria-label={t('selectAllAria')}
                />
              </label>
            </TableHead>
            <TableHead className={cn(HEAD, 'w-7 text-end max-sm:hidden')}>#</TableHead>
            <TableHead className={cn(HEAD, 'w-16 sm:w-24')}>
              <span className="sr-only">{t('titleColumn')}</span>
            </TableHead>
            <TableHead className={HEAD}>{t('titleColumn')}</TableHead>
            <TableHead className={cn(HEAD, 'w-14 text-end max-sm:hidden')}>
              {t('timeColumn')}
            </TableHead>
            <TableHead className={cn(HEAD, 'w-auto text-end sm:w-[152px]')}>
              {t('statusColumn')}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, i) => {
            const view = views[i]
            const isTicked = view.tickable && ticked.has(row.videoId)
            const clickable = view.tickable && !disabled
            const reason = view.reasonKey
              ? t.rich(view.reasonKey, {
                  ...view.params,
                  bdi: (chunks) => <bdi>{chunks}</bdi>,
                })
              : null
            const visibility = view.sublineKeys.map((key) => t(key)).join(' · ')
            return (
              <TableRow
                key={row.videoId}
                aria-disabled={view.tickable ? undefined : 'true'}
                onClick={clickable ? () => onToggle(row.videoId) : undefined}
                className={cn(
                  'h-16 border-t border-b-0 border-[var(--line)]',
                  view.tickable
                    ? 'hover:bg-white/[0.03]'
                    : 'hover:bg-transparent',
                  clickable && 'cursor-pointer'
                )}
              >
                <TableCell className="w-11 p-0">
                  <label
                    className="flex size-11 items-center justify-center"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <Checkbox
                      checked={isTicked}
                      disabled={disabled || !view.tickable}
                      onCheckedChange={() => onToggle(row.videoId)}
                      aria-label={t.markup('rowSelectAria', {
                        title: row.title,
                        bdi: (chunks) => isolate(chunks),
                      })}
                    />
                  </label>
                </TableCell>
                <TableCell
                  className={cn(
                    CELL,
                    'w-7 text-end text-sm text-[var(--text-mute)] max-sm:hidden'
                  )}
                >
                  {numbers.format(row.position)}
                </TableCell>
                <TableCell className={cn(CELL, 'w-16 sm:w-24')}>
                  {row.thumbnailUrl ? (
                    <Image
                      src={row.thumbnailUrl}
                      alt=""
                      width={96}
                      height={54}
                      unoptimized
                      className={cn(
                        'h-9 w-16 rounded-media object-cover sm:h-[54px] sm:w-24',
                        !view.tickable && 'opacity-40'
                      )}
                    />
                  ) : (
                    <div
                      className={cn(
                        'h-9 w-16 rounded-media bg-[var(--bg-3)] sm:h-[54px] sm:w-24',
                        !view.tickable && 'opacity-40'
                      )}
                    />
                  )}
                </TableCell>
                <TableCell className={cn(CELL, 'max-w-0')}>
                  <div
                    className={cn(
                      'min-w-0',
                      !view.tickable && 'text-[var(--text-mute)]'
                    )}
                  >
                    <div className="truncate text-sm">
                      <bdi>{row.title}</bdi>
                    </div>
                    <div className="mt-1 truncate text-[11px] text-[var(--text-mute)]">
                      {view.tickable ? visibility : reason}
                      {row.durationSeconds !== null ? (
                        <span className="tabular-nums sm:hidden">
                          {(view.tickable ? visibility : reason) ? ' · ' : ''}
                          {view.time}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </TableCell>
                <TableCell
                  className={cn(
                    CELL,
                    'w-14 text-end text-sm text-[var(--text-dim)] tabular-nums max-sm:hidden'
                  )}
                >
                  {view.time}
                </TableCell>
                <TableCell className={cn(CELL, 'w-auto text-end sm:w-[152px]')}>
                  <YouTubeStatusChip tone={view.tone}>
                    {tStatus(view.chipKey)}
                  </YouTubeStatusChip>
                </TableCell>
              </TableRow>
            )
          })}
          {Array.from({ length: skeletonRows }, (_, i) => (
            <TableRow
              key={`skeleton-${i}`}
              aria-hidden
              className="h-16 border-t border-b-0 border-[var(--line)] hover:bg-transparent"
            >
              <TableCell className="w-11 p-0">
                <div className="flex size-11 items-center justify-center">
                  <Skeleton className="size-5 rounded-md" />
                </div>
              </TableCell>
              <TableCell className={cn(CELL, 'w-7 max-sm:hidden')} />
              <TableCell className={cn(CELL, 'w-16 sm:w-24')}>
                <Skeleton className="h-9 w-16 rounded-media sm:h-[54px] sm:w-24" />
              </TableCell>
              <TableCell className={CELL}>
                <Skeleton className="h-3.5 w-3/4" />
                <Skeleton className="mt-2 h-3 w-1/3" />
              </TableCell>
              <TableCell className={cn(CELL, 'w-14 max-sm:hidden')} />
              <TableCell className={cn(CELL, 'w-auto sm:w-[152px]')}>
                <Skeleton className="ms-auto h-6 w-24 rounded-full" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
