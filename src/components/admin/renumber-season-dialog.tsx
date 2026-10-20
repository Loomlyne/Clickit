'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Loader2, ListOrdered, XIcon } from 'lucide-react'
import { toast } from 'sonner'

import { useRouter } from '@/i18n/navigation'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { renumberSeason } from '@/app/[locale]/admin/actions'
import { planRenumber, type RenumberEpisode } from '@/lib/admin/renumber-plan'

// UI-SPEC 5.2 (D-14, D-19): the deliberate "Renumber 1 to N". Its own Dialog,
// not ConfirmDialog, so the archive dialogs are untouched. The primitive's
// close button uses a physical `right-4` and a 32px target, so it is turned
// off and replaced by a 44px logical-end one (checker flag d).

const LIST_MAX = 8

interface RenumberSeasonDialogProps {
  showId: string
  seasonId: string
  /** Active (not archived) episodes of the season. */
  episodes: RenumberEpisode[]
}

/** Plain sentence end for a server reason dropped into a longer message. */
function sentence(text: string): string {
  const trimmed = text.trim()
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`
}

export function RenumberSeasonDialog({
  showId,
  seasonId,
  episodes,
}: RenumberSeasonDialogProps) {
  const router = useRouter()
  const t = useTranslations('admin.episodesTable')
  const tCommon = useTranslations('common')
  const tConfirm = useTranslations('admin.confirmDialog')
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)

  const plan = planRenumber(episodes)
  // Nothing to close: the control only exists while there is something to fix.
  if (!plan.needed) return null

  const shown = plan.changes.slice(0, LIST_MAX)
  const hidden = plan.changes.length - shown.length
  const range = { first: 1, count: plan.count }

  function handleOpenChange(next: boolean) {
    // The call is all-or-nothing; closing mid-way would hide its answer.
    if (loading) return
    setOpen(next)
    if (!next) setFailure(null)
  }

  async function handleConfirm() {
    setLoading(true)
    setFailure(null)
    try {
      const result = await renumberSeason(showId, seasonId)
      if (result.success) {
        setOpen(false)
        toast.success(t('renumberDone', range))
        router.refresh()
      } else {
        setFailure(result.error || tCommon('error'))
      }
    } catch {
      setFailure(tCommon('error'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button
        variant="outline"
        className="min-h-11 px-6 py-2 text-sm font-bold"
        onClick={() => setOpen(true)}
      >
        <ListOrdered className="me-1 size-4" />
        {t('renumberButton', range)}
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent showCloseButton={false}>
          <DialogClose
            disabled={loading}
            aria-label={tCommon('close')}
            className="absolute end-4 top-4 flex size-11 items-center justify-center rounded-full border border-[var(--line)] bg-white/[0.04] text-[var(--text-dim)] transition-colors hover:text-[var(--text)] focus-visible:ring-2 focus-visible:ring-[var(--ring,currentColor)] focus-visible:outline-hidden disabled:opacity-35"
          >
            <XIcon className="size-4" aria-hidden />
          </DialogClose>
          <DialogHeader className="pe-12 text-start">
            <DialogTitle className="text-[20px] leading-tight font-bold">
              {t('renumberTitle', range)}
            </DialogTitle>
            <DialogDescription className="text-sm leading-normal">
              {t('renumberDescription', range)}
            </DialogDescription>
          </DialogHeader>

          <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto">
            {shown.map((change) => (
              <li
                key={change.id}
                className="flex items-center gap-3 rounded-[12px] bg-[var(--bg-2)] px-3 py-2 text-sm"
              >
                <span className="shrink-0">
                  {t('renumberChange', { from: change.from, to: change.to })}
                </span>
                <bdi className="block min-w-0 truncate text-[var(--text-dim)]">
                  {change.title}
                </bdi>
              </li>
            ))}
          </ul>
          {hidden > 0 && (
            <p className="text-sm text-[var(--text-mute)]">
              {t('renumberMore', { count: hidden })}
            </p>
          )}

          {failure && (
            <p role="alert" className="text-brand-red-safe mt-4 text-sm">
              {t('renumberFailed', { reason: sentence(failure) })}
            </p>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              className="min-h-11 px-6 py-2 text-sm font-bold"
              onClick={() => handleOpenChange(false)}
              disabled={loading}
            >
              {tCommon('cancel')}
            </Button>
            <Button
              className="min-h-11 px-6 py-2 text-sm font-bold"
              onClick={handleConfirm}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="me-1 size-4 animate-spin motion-reduce:animate-none" />
                  {tConfirm('processing')}
                </>
              ) : (
                t('renumberConfirm')
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
