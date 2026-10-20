'use client'

import { useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { CalendarClock, TriangleAlert } from 'lucide-react'
import { useRouter } from '@/i18n/navigation'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  applyShowSchedule,
  previewShowSchedule,
  unscheduleShowEpisodes,
  type PlannedEpisodeSlot,
} from '@/app/[locale]/admin/actions'

type ScheduleEpisodesButtonProps = {
  showId: string
  /** Controlled mode (the import sheet opens it); omit for the self-opening button. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Limit the schedule to these episodes (the freshly imported drafts). */
  episodeIds?: string[]
  /** Controlled use: render only the dialog, no trigger button. */
  hideTrigger?: boolean
}

/** The stored YouTube check says the video cannot play (null: never checked). */
function isCantPlay(slot: PlannedEpisodeSlot): boolean {
  return (
    slot.hasVideo && slot.youtubeStatus !== null && slot.youtubeStatus !== 'ok'
  )
}

type LoadedPlan = { plan: PlannedEpisodeSlot[]; error: string | null }

/**
 * Bulk-schedules a show's unpublished episodes onto its broadcast days.
 *
 * Always previews before writing: a mis-set broadcast day would otherwise
 * silently re-date every episode of a season in one click, so the admin sees
 * the full generated list — and any episode still missing a video, missing an
 * English title or unable to play — before anything is saved.
 */
export function ScheduleEpisodesButton({
  showId,
  open: openProp,
  onOpenChange,
  episodeIds,
  hideTrigger = false,
}: ScheduleEpisodesButtonProps) {
  const router = useRouter()
  const locale = useLocale()
  const t = useTranslations('admin.scheduleEpisodes')
  const tCommon = useTranslations('common')
  const tStatus = useTranslations('admin.youtubeStatus')
  const tTable = useTranslations('admin.episodesTable')

  const [ownOpen, setOwnOpen] = useState(false)
  const controlled = openProp !== undefined
  const open = controlled ? openProp : ownOpen
  const [saving, setSaving] = useState(false)
  // null until the preview for this opening has answered.
  const [loaded, setLoaded] = useState<LoadedPlan | null>(null)
  const loading = open && loaded === null
  const plan = loaded?.plan ?? []
  const error = loaded?.error ?? null

  function setOpen(next: boolean) {
    if (!next) setLoaded(null)
    if (!controlled) setOwnOpen(next)
    onOpenChange?.(next)
  }

  // Previews whenever the dialog opens (own button or the import sheet).
  useEffect(() => {
    if (!open) return
    let cancelled = false
    previewShowSchedule(showId, episodeIds)
      .then((result) => {
        if (cancelled) return
        setLoaded(
          result.success
            ? { plan: result.data ?? [], error: null }
            : { plan: [], error: result.error ?? '' }
        )
      })
      .catch(() => {
        if (!cancelled) setLoaded({ plan: [], error: '' })
      })
    return () => {
      cancelled = true
    }
  }, [open, showId, episodeIds])

  // Air times are authored in UAE time; render them in it too, so what the
  // admin confirms is what viewers get.
  const formatSlot = (iso: string) =>
    new Intl.DateTimeFormat(locale === 'ar' ? 'ar-AE' : 'en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Dubai',
    }).format(new Date(iso))

  async function confirm() {
    setSaving(true)
    const result = await applyShowSchedule(showId, episodeIds)
    setSaving(false)
    if (result.success) {
      toast.success(t('scheduled', { count: result.data?.scheduled ?? 0 }))
      setOpen(false)
      router.refresh()
    } else {
      toast.error(result.error ?? t('failed'))
    }
  }

  async function cancelSchedule() {
    setSaving(true)
    const result = await unscheduleShowEpisodes(showId)
    setSaving(false)
    if (result.success) {
      toast.success(t('unscheduled', { count: result.data?.cleared ?? 0 }))
      setOpen(false)
      router.refresh()
    } else {
      toast.error(result.error ?? t('failed'))
    }
  }

  const missingVideo = plan.filter((slot) => !slot.hasVideo).length
  const needsEnglish = plan.filter((slot) => slot.needsEnglishTitle).length
  const cantPlay = plan.filter(isCantPlay).length
  const numbers = new Intl.NumberFormat(locale)

  return (
    <>
      {hideTrigger ? null : (
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <CalendarClock className="me-1 size-3.5" />
          {t('button')}
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('title')}</DialogTitle>
            <DialogDescription>
              {loading
                ? t('loading')
                : error !== null
                  ? error || t('failed')
                  : t('description')}
            </DialogDescription>
          </DialogHeader>

          {!loading && error === null && plan.length === 0 && (
            <p className="text-muted-foreground text-sm">{t('empty')}</p>
          )}

          {plan.length > 0 && (
            <>
              {missingVideo + needsEnglish + cantPlay > 0 && (
                <div className="border-brand-orange-safe/25 bg-brand-orange-safe/10 text-brand-orange-safe flex items-start gap-2 rounded-lg border px-3 py-2.5 text-xs">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                  <span className="flex flex-col gap-1">
                    {missingVideo > 0 && (
                      <span>
                        {t('missingVideoWarning', { count: missingVideo })}
                      </span>
                    )}
                    {needsEnglish > 0 && (
                      <span>
                        {numbers.format(needsEnglish)} ·{' '}
                        {tStatus('needsEnglishTitle')}
                      </span>
                    )}
                    {cantPlay > 0 && (
                      <span>
                        {numbers.format(cantPlay)} · {tTable('cantPlayBadge')}
                      </span>
                    )}
                  </span>
                </div>
              )}

              <ul className="max-h-72 space-y-1 overflow-y-auto">
                {plan.map((slot) => (
                  <li
                    key={slot.episodeId}
                    className="flex items-center justify-between gap-3 rounded-lg bg-[var(--bg-2)] px-3 py-2 text-sm"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="text-muted-foreground shrink-0 text-xs">
                        S{slot.seasonNumber} E{slot.episodeNumber}
                      </span>
                      <span className="truncate">{slot.title}</span>
                      {(!slot.hasVideo ||
                        slot.needsEnglishTitle ||
                        isCantPlay(slot)) && (
                        <TriangleAlert className="text-brand-orange-safe size-3.5 shrink-0" />
                      )}
                    </span>
                    <span className="text-muted-foreground shrink-0 text-xs">
                      {formatSlot(slot.publishAt)}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}

          <DialogFooter className="gap-2 sm:justify-between">
            {/* Cancelling is whole-show: not offered when limited to chosen episodes. */}
            {episodeIds ? null : (
              <Button
                variant="ghost"
                onClick={cancelSchedule}
                disabled={saving || loading}
                className="text-[var(--text-dim)] hover:text-[var(--text)]"
              >
                {t('unscheduleButton')}
              </Button>
            )}
            <div className="ms-auto flex gap-2">
              <Button
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={saving}
              >
                {tCommon('cancel')}
              </Button>
              <Button
                onClick={confirm}
                disabled={saving || loading || plan.length === 0}
              >
                {saving
                  ? t('saving')
                  : t('confirmButton', { count: plan.length })}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
