'use client'

import { useState } from 'react'
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

/**
 * Bulk-schedules a show's unpublished episodes onto its broadcast days.
 *
 * Always previews before writing: a mis-set broadcast day would otherwise
 * silently re-date every episode of a season in one click, so the admin sees
 * the full generated list — and any episode still missing a video — before
 * anything is saved.
 */
export function ScheduleEpisodesButton({ showId }: { showId: string }) {
  const router = useRouter()
  const locale = useLocale()
  const t = useTranslations('admin.scheduleEpisodes')
  const tCommon = useTranslations('common')

  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [plan, setPlan] = useState<PlannedEpisodeSlot[]>([])
  const [error, setError] = useState<string | null>(null)

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

  async function openDialog() {
    setOpen(true)
    setLoading(true)
    setError(null)
    setPlan([])
    const result = await previewShowSchedule(showId)
    if (result.success) {
      setPlan(result.data ?? [])
    } else {
      setError(result.error ?? t('failed'))
    }
    setLoading(false)
  }

  async function confirm() {
    setSaving(true)
    const result = await applyShowSchedule(showId)
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

  return (
    <>
      <Button variant="outline" size="sm" onClick={openDialog}>
        <CalendarClock className="me-1 size-3.5" />
        {t('button')}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('title')}</DialogTitle>
            <DialogDescription>
              {loading ? t('loading') : error ? error : t('description')}
            </DialogDescription>
          </DialogHeader>

          {!loading && !error && plan.length === 0 && (
            <p className="text-muted-foreground text-sm">{t('empty')}</p>
          )}

          {plan.length > 0 && (
            <>
              {missingVideo > 0 && (
                <div className="border-brand-orange-safe/25 bg-brand-orange-safe/10 text-brand-orange-safe flex items-start gap-2 rounded-lg border px-3 py-2.5 text-xs">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                  <span>
                    {t('missingVideoWarning', { count: missingVideo })}
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
                      {!slot.hasVideo && (
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
            <Button
              variant="ghost"
              onClick={cancelSchedule}
              disabled={saving || loading}
              className="text-muted-foreground hover:text-foreground"
            >
              {t('unscheduleButton')}
            </Button>
            <div className="flex gap-2">
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
