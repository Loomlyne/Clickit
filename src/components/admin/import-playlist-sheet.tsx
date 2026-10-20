'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { ListVideo, Loader2, XIcon } from 'lucide-react'
import { useRouter } from '@/i18n/navigation'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { ImportPlaylistTable } from '@/components/admin/import-playlist-table'
import { YouTubeStatusChip } from '@/components/admin/youtube-status-chip'
import {
  commitImport,
  previewPlaylistPage,
} from '@/app/[locale]/admin/actions'
import {
  canImport,
  initialTicks,
  summarizeTicks,
  tickedInPlaylistOrder,
  toTableRow,
} from '@/lib/admin/import-sheet-state'
import type { ImportTableRow } from '@/lib/admin/import-row-view'
import { IMPORT_MAX_ITEMS } from '@/lib/admin/youtube-import'
import { YOUTUBE_ERROR_MESSAGE_KEYS, type YouTubeErrorCode } from '@/lib/youtube-errors'
import { isolate } from '@/lib/i18n-format'
import { parsePlaylistId } from '@/server/youtube/urls'

// UI-SPEC 1: the import side sheet (D-01..D-07). The table is 06-12's
// ImportPlaylistTable; this component owns the frame, the link field, the
// target picker, the page-by-page reading loop and the commit. Only the
// ticked video ids, the playlist id and the target ever leave the browser
// (T-06-69); the server re-reads YouTube.

export type ImportSheetSeason = {
  id: string
  seasonNumber: number
  title: string
  lastEpisodeNumber: number
}

type Props = {
  showId: string
  seasons: ImportSheetSeason[]
  nextSeasonNumber: number
  trigger?: 'primary' | 'outline'
}

type DynamicTranslator = (key: string, values?: Record<string, string | number>) => string

const NEW_SEASON = 'new'
const READ_DEBOUNCE_MS = 400
const TITLE_MAX = 120
const LABEL_CLASS =
  'mb-2 text-[11px] font-normal tracking-[0.14em] uppercase leading-[1.4] text-[var(--text-mute)]'
const BUTTON_CLASS = 'min-h-11 px-6 py-2 text-sm font-bold'

type ReadFrom = { page: number; token: string | undefined; playlistId: string | null }

export function ImportPlaylistSheet({
  showId,
  seasons,
  nextSeasonNumber,
  trigger = 'primary',
}: Props) {
  const router = useRouter()
  const locale = useLocale()
  const t = useTranslations('admin.youtubeImport')
  const tErr = useTranslations('admin.youtubeErrors') as unknown as DynamicTranslator
  const tCommon = useTranslations('common')
  const ids = useId()
  const linkId = `${ids}-link`
  const targetId = `${ids}-target`
  const titleId = `${ids}-title`

  const [open, setOpen] = useState(false)
  const [link, setLink] = useState('')
  const [linkError, setLinkError] = useState<YouTubeErrorCode | null>(null)
  const [targetValue, setTargetValue] = useState(NEW_SEASON)
  const [seasonTitle, setSeasonTitle] = useState('')

  const [rows, setRows] = useState<ImportTableRow[]>([])
  const [ticked, setTicked] = useState<Set<string>>(new Set())
  const [reading, setReading] = useState(false)
  const [pagesRead, setPagesRead] = useState(0)
  const [capped, setCapped] = useState(false)
  const [playlist, setPlaylist] = useState<{ id: string; title: string } | null>(null)
  const [readError, setReadError] = useState<YouTubeErrorCode | null>(null)
  const [, setResumeAt] = useState<ReadFrom | null>(null)

  const [importing, setImporting] = useState(false)

  // A new read supersedes an in-flight one; a stale loop stops at its next await.
  const runRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Once the admin types a title, a later re-read never overwrites it.
  const titleEditedRef = useRef(false)

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      runRef.current += 1
    },
    []
  )

  const existingSeason =
    targetValue === NEW_SEASON ? null : (seasons.find((s) => s.id === targetValue) ?? null)
  const targetKind = existingSeason ? 'existing' : 'new'

  const summary = summarizeTicks(
    rows,
    ticked,
    existingSeason
      ? { kind: 'existing', lastEpisodeNumber: existingSeason.lastEpisodeNumber }
      : { kind: 'new' }
  )
  const importable = canImport({
    tickedCount: summary.tickedCount,
    target: { kind: targetKind },
    seasonTitle,
    reading,
    importing,
    blocked: readError !== null,
  })

  function clearTimer() {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = null
  }

  function resetPreview() {
    runRef.current += 1
    setRows([])
    setTicked(new Set())
    setReading(false)
    setPagesRead(0)
    setCapped(false)
    setPlaylist(null)
    setReadError(null)
    setResumeAt(null)
  }

  function resetAll() {
    clearTimer()
    resetPreview()
    setLink('')
    setLinkError(null)
    setTargetValue(NEW_SEASON)
    setSeasonTitle('')
    titleEditedRef.current = false
    setImporting(false)
  }

  function handleOpenChange(next: boolean) {
    // Esc, outside click and the close buttons do nothing while importing.
    if (importing) return
    if (!next) resetAll()
    setOpen(next)
  }

  /** Reads page by page (at most IMPORT_MAX_ITEMS videos); a refusal stops the loop. */
  async function readLoop(url: string, from: ReadFrom) {
    const run = ++runRef.current
    setReading(true)
    setReadError(null)
    setResumeAt(null)
    let { page, token, playlistId } = from
    const lastPage = IMPORT_MAX_ITEMS / 50 - 1
    while (page <= lastPage) {
      const result = await previewPlaylistPage(
        page === 0
          ? { showId, url, page }
          : { showId, playlistId: playlistId ?? '', pageToken: token, page }
      )
      if (run !== runRef.current) return
      if (!result.success) {
        // A refusal without a code is an unexpected failure: treat it as the network case.
        setReadError(result.data?.code ?? 'network')
        setResumeAt({ page, token, playlistId })
        setReading(false)
        return
      }
      const data = result.data
      if (page === 0) {
        const parsed = parsePlaylistId(url)
        playlistId = data.playlist?.id ?? (parsed.ok ? parsed.id : null)
        if (playlistId) {
          const title = data.playlist?.title ?? ''
          setPlaylist({ id: playlistId, title })
          if (!titleEditedRef.current) setSeasonTitle(title.slice(0, TITLE_MAX))
        }
      }
      const fresh = data.rows.map(toTableRow)
      setRows((prev) => [...prev, ...fresh])
      setTicked((prev) => new Set([...prev, ...initialTicks(fresh)]))
      setPagesRead(page + 1)
      setCapped(data.capped)
      if (!data.nextPageToken) break
      page += 1
      token = data.nextPageToken
    }
    setReading(false)
  }

  function startReading(url: string) {
    resetPreview()
    void readLoop(url, { page: 0, token: undefined, playlistId: null })
  }

  /** Called on every link change; `immediate` for paste and Enter. */
  function handleLink(value: string, immediate: boolean) {
    clearTimer()
    setLink(value)
    setLinkError(null)
    const trimmed = value.trim()
    if (!trimmed) {
      resetPreview()
      return
    }
    const attempt = () => {
      const parsed = parsePlaylistId(trimmed)
      if (!parsed.ok) {
        resetPreview()
        setLinkError(parsed.code)
        return
      }
      startReading(trimmed)
    }
    if (immediate) attempt()
    else timerRef.current = setTimeout(attempt, READ_DEBOUNCE_MS)
  }

  function toggle(videoId: string) {
    if (importing) return
    setTicked((prev) => {
      const next = new Set(prev)
      if (next.has(videoId)) next.delete(videoId)
      else next.add(videoId)
      return next
    })
  }

  function toggleAllReady() {
    if (importing) return
    setTicked((prev) => {
      const ready = rows.filter((r) => r.status === 'ok').map((r) => r.videoId)
      const allTicked = ready.length > 0 && ready.every((id) => prev.has(id))
      return allTicked ? new Set() : new Set(ready)
    })
  }

  async function runImport() {
    if (!importable || !playlist) return
    setImporting(true)
    try {
      const result = await commitImport({
        showId,
        playlistId: playlist.id,
        videoIds: tickedInPlaylistOrder(rows, ticked),
        target: existingSeason
          ? { kind: 'existing', seasonId: existingSeason.id }
          : { kind: 'new', seasonTitle: seasonTitle.trim() },
      })
      if (result.success) {
        handleOpenChange(false)
        router.refresh()
      }
    } finally {
      setImporting(false)
    }
  }

  const showTable = rows.length > 0 || reading

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <Button variant={trigger === 'outline' ? 'outline' : 'default'} className={BUTTON_CLASS}>
          <ListVideo className="size-4" aria-hidden />
          {t('openButton')}
        </Button>
      </SheetTrigger>
      <SheetContent
        side={locale === 'ar' ? 'left' : 'right'}
        showCloseButton={false}
        className="flex w-full flex-col gap-0 p-0 sm:max-w-[640px]"
      >
        <div className="shrink-0 border-b border-[var(--line)] px-6 pt-6 pb-4">
          <div className="flex items-start justify-between gap-4">
            <SheetTitle className="text-[20px] leading-tight font-bold">{t('title')}</SheetTitle>
            <button
              type="button"
              onClick={() => handleOpenChange(false)}
              disabled={importing}
              aria-label={tCommon('close')}
              className="flex size-11 shrink-0 items-center justify-center rounded-full border border-[var(--line)] bg-white/[0.04] text-[var(--text-dim)] hover:text-[var(--text)] disabled:pointer-events-none disabled:opacity-50"
            >
              <XIcon className="size-4" aria-hidden />
            </button>
          </div>
          <SheetDescription className="mt-1 text-sm text-[var(--text-mute)]">
            {t('description')}
          </SheetDescription>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-4">
          <div>
            <Label htmlFor={linkId} className={LABEL_CLASS}>
              {t('linkLabel')}
            </Label>
            <Input
              id={linkId}
              type="url"
              inputMode="url"
              dir="ltr"
              className="text-sm"
              autoFocus
              value={link}
              disabled={importing}
              placeholder={t('linkPlaceholder')}
              aria-invalid={linkError ? true : undefined}
              onChange={(e) =>
                handleLink(
                  e.target.value,
                  (e.nativeEvent as InputEvent).inputType === 'insertFromPaste'
                )
              }
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleLink(link, true)
                }
              }}
            />
            {linkError ? (
              <p role="alert" className="text-brand-red-safe mt-2 text-sm">
                {tErr(YOUTUBE_ERROR_MESSAGE_KEYS[linkError])}
              </p>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor={targetId} className={LABEL_CLASS}>
                {t('targetLabel')}
              </Label>
              <Select value={targetValue} onValueChange={setTargetValue} disabled={importing}>
                <SelectTrigger id={targetId} className="w-full text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NEW_SEASON}>
                    {t('targetNewSeason', { number: nextSeasonNumber })}
                  </SelectItem>
                  {seasons.map((season) => (
                    <SelectItem key={season.id} value={season.id}>
                      {t.markup('targetExistingSeason', {
                        number: season.seasonNumber,
                        title: season.title,
                        bdi: (chunks) => isolate(chunks),
                      })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {existingSeason ? (
              <p className="flex min-h-11 items-center self-end text-sm text-[var(--text-dim)]">
                {existingSeason.lastEpisodeNumber > 0
                  ? t('appendNote', { last: existingSeason.lastEpisodeNumber })
                  : t('appendNoteEmpty', { first: 1 })}
              </p>
            ) : (
              <div>
                <Label htmlFor={titleId} className={LABEL_CLASS}>
                  {t('seasonTitleLabel')}
                </Label>
                <Input
                  id={titleId}
                  className="text-sm"
                  dir="auto"
                  maxLength={TITLE_MAX}
                  required
                  value={seasonTitle}
                  disabled={importing}
                  placeholder={t('seasonTitlePlaceholder')}
                  aria-invalid={rows.length > 0 && seasonTitle.trim() === '' ? true : undefined}
                  onChange={(e) => {
                    titleEditedRef.current = true
                    setSeasonTitle(e.target.value)
                  }}
                />
                {rows.length > 0 && seasonTitle.trim() === '' ? (
                  <p className="text-brand-red-safe mt-2 text-sm">{t('seasonTitleRequired')}</p>
                ) : null}
              </div>
            )}
          </div>

          {showTable ? (
            <>
              <div aria-live="polite" aria-busy={reading} className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  {summary.ready > 0 ? (
                    <YouTubeStatusChip tone="ok">
                      {t('summaryReady', { count: summary.ready })}
                    </YouTubeStatusChip>
                  ) : null}
                  {summary.cantPlay > 0 ? (
                    <YouTubeStatusChip tone="bad">
                      {t('summaryCantPlay', { count: summary.cantPlay })}
                    </YouTubeStatusChip>
                  ) : null}
                  {summary.already > 0 ? (
                    <YouTubeStatusChip tone="neutral">
                      {t('summaryAlready', { count: summary.already })}
                    </YouTubeStatusChip>
                  ) : null}
                  <span className="ms-auto text-sm text-[var(--text-mute)]">
                    {reading ? (
                      <span className="flex items-center gap-2">
                        <Loader2
                          className="size-4 animate-spin motion-reduce:animate-none"
                          aria-hidden
                        />
                        {t('reading', { page: pagesRead + 1 })}
                      </span>
                    ) : (
                      t('readMeta', { videos: rows.length, pages: pagesRead })
                    )}
                  </span>
                </div>
                {summary.tickedCount > 0 ? (
                  <p className="text-sm text-[var(--text-dim)]">
                    {t('numberingNote', {
                      count: summary.tickedCount,
                      first: summary.firstNumber,
                      last: summary.lastNumber,
                      season: existingSeason ? existingSeason.seasonNumber : nextSeasonNumber,
                    })}
                  </p>
                ) : null}
              </div>
              {capped ? (
                <p className="text-sm text-[var(--text-mute)]">
                  {t('capNote', { max: IMPORT_MAX_ITEMS })}
                </p>
              ) : null}
              <ImportPlaylistTable
                rows={rows}
                ticked={ticked}
                onToggle={toggle}
                onToggleAllReady={toggleAllReady}
                skeletonRows={reading ? (rows.length ? 2 : 6) : 0}
                disabled={importing}
                locale={locale}
              />
            </>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-[var(--line)] bg-[var(--bg-1)] px-6 py-4">
          <Button
            variant="ghost"
            className="min-h-11 border-transparent bg-transparent px-6 py-2 text-sm font-bold text-[var(--text-dim)] hover:bg-white/[0.04] hover:text-[var(--text)]"
            disabled={importing}
            onClick={() => handleOpenChange(false)}
          >
            {tCommon('cancel')}
          </Button>
          <Button className={BUTTON_CLASS} disabled={!importable} onClick={runImport}>
            {importing ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden /> : null}
            {importing ? t('importing') : t('importButton', { count: summary.tickedCount })}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
