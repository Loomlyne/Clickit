'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { RotateCcw, Trash2, AlertTriangle } from 'lucide-react'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { EmptyState } from '@/components/admin/empty-state'
import { ConfirmDialog } from '@/components/admin/confirm-dialog'
import { AdminPanel, AdminTableShell } from '@/components/admin/admin-shell'
import {
  restoreShow,
  deleteShowPermanently,
  resolveRestoreConflictsAndRestore,
} from '@/app/[locale]/admin/actions'
import type {
  EpisodeConflict,
  ShowRestoreConflict,
} from '@/app/[locale]/admin/actions'
import { toast } from 'sonner'
import type { Database } from '@/lib/database.types'

type Show = Database['public']['Tables']['shows']['Row']
const DATE_LOCALES: Record<string, string> = {
  ar: 'ar-AE-u-nu-latn',
  en: 'en-US',
}

interface ArchiveTableProps {
  shows: Show[]
}

function formatDate(dateString: string, locale: string): string {
  return new Date(dateString).toLocaleDateString(DATE_LOCALES[locale] ?? DATE_LOCALES.en, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function ArchiveTable({ shows }: ArchiveTableProps) {
  const t = useTranslations('admin.archive')
  const tCommon = useTranslations('common')
  const locale = useLocale()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingShow, setDeletingShow] = useState<Show | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [restoring, setRestoring] = useState<string | null>(null)

  // Conflict resolution state
  const [conflictDialogOpen, setConflictDialogOpen] = useState(false)
  const [conflictShow, setConflictShow] = useState<Show | null>(null)
  const [conflicts, setConflicts] = useState<EpisodeConflict[]>([])
  const [showConflict, setShowConflict] = useState<ShowRestoreConflict | null>(null)
  const [restoreDraft, setRestoreDraft] = useState({ title: '', slug: '' })
  const [fixes, setFixes] = useState<Record<string, number>>({})
  const [resolving, setResolving] = useState(false)

  function handleDeleteClick(show: Show) {
    setDeletingShow(show)
    setDeleteDialogOpen(true)
  }

  async function handleRestore(show: Show) {
    setRestoring(show.id)
    const result = await restoreShow(show.id)
    setRestoring(null)
    if (result.success) {
      toast.success(t('restoredToast'))
    } else if (result.showConflict || (result.conflicts && result.conflicts.length > 0)) {
      setConflictShow(show)
      setShowConflict(result.showConflict ?? null)
      setRestoreDraft({
        title: result.showConflict?.title ?? show.title,
        slug: result.showConflict?.slug ?? show.slug,
      })
      setConflicts(result.conflicts ?? [])
      const initialFixes: Record<string, number> = {}
      for (const c of result.conflicts ?? []) {
        initialFixes[c.episodeId] = c.episodeNumber
      }
      setFixes(initialFixes)
      setConflictDialogOpen(true)
    } else {
      toast.error(result.error ?? tCommon('error'))
    }
  }

  async function handleResolveAndRestore() {
    if (!conflictShow) return
    setResolving(true)
    const fixArray = Object.entries(fixes).map(([episodeId, newEpisodeNumber]) => ({
      episodeId,
      newEpisodeNumber,
    }))
    const result = await resolveRestoreConflictsAndRestore(conflictShow.id, {
      title: showConflict ? restoreDraft.title : undefined,
      slug: showConflict ? restoreDraft.slug : undefined,
      episodeFixes: fixArray,
    })
    setResolving(false)
    if (result.success) {
      setConflictDialogOpen(false)
      setConflictShow(null)
      setConflicts([])
      setShowConflict(null)
      toast.success(t('restoredToast'))
    } else if (result.showConflict || (result.conflicts && result.conflicts.length > 0)) {
      setShowConflict(result.showConflict ?? null)
      if (result.showConflict) {
        setRestoreDraft({
          title: result.showConflict.title,
          slug: result.showConflict.slug,
        })
      }
      setConflicts(result.conflicts ?? [])
      const newFixes: Record<string, number> = {}
      for (const c of result.conflicts ?? []) {
        newFixes[c.episodeId] = fixes[c.episodeId] ?? c.episodeNumber
      }
      setFixes(newFixes)
      toast.error(t('conflictsRemainToast'))
    } else {
      toast.error(result.error ?? tCommon('error'))
    }
  }

  async function handleDeleteConfirm() {
    if (!deletingShow) return
    setDeleting(true)
    const result = await deleteShowPermanently(deletingShow.id)
    setDeleting(false)
    if (result.success) {
      toast.success(t('deletedToast'))
      setDeleteDialogOpen(false)
      setDeletingShow(null)
    } else {
      toast.error(result.error ?? tCommon('error'))
    }
  }

  if (shows.length === 0) {
    return <EmptyState heading={t('emptyHeading')} body={t('emptyDescription')} />
  }

  return (
    <TooltipProvider delayDuration={300}>
      <AdminPanel>
        <div className="flex items-center justify-between pb-4 text-sm text-muted-foreground">
          <span>{t('archivedShowsCount', { count: shows.length })}</span>
          <span>{t('newestFirst')}</span>
        </div>

        <AdminTableShell>
          <Table>
            <TableHeader>
              <TableRow className="bg-transparent">
                <TableHead>{t('showColumn')}</TableHead>
                <TableHead className="hidden w-[100px] sm:table-cell">{t('genreColumn')}</TableHead>
                <TableHead className="hidden w-[130px] md:table-cell">{t('archivedColumn')}</TableHead>
                <TableHead className="w-[180px] text-end">{t('actionsColumn')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shows.map((show) => (
                <TableRow key={show.id} className="group transition-colors hover:bg-white/[0.02]">
                  <TableCell>
                    <span className="font-medium">{show.title}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground sm:hidden">{show.genre}</span>
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground sm:table-cell">{show.genre}</TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                    {formatDate(show.updated_at, locale)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRestore(show)}
                            disabled={restoring === show.id}
                          >
                            <RotateCcw className="me-1 size-3.5" />
                            {restoring === show.id ? t('restoring') : t('restoreButton')}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{t('restoreTooltip')}</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteClick(show)}
                          >
                            <Trash2 className="me-1 size-3.5" />
                            {tCommon('delete')}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{t('deleteTooltip')}</TooltipContent>
                      </Tooltip>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </AdminTableShell>
      </AdminPanel>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title={t('deletePermanentlyTitle')}
        description={t('deletePermanentlyDescription', { title: deletingShow?.title ?? t('thisShow') })}
        confirmLabel={t('deletePermanentlyButton')}
        onConfirm={handleDeleteConfirm}
        destructive
        loading={deleting}
      />

      {/* Conflict resolution dialog */}
      <Dialog open={conflictDialogOpen} onOpenChange={setConflictDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-amber-500" />
              {showConflict ? t('showConflictHeading') : t('conflictHeading')}
            </DialogTitle>
            <DialogDescription>
              {showConflict ? t('showConflictDescription') : t('conflictDescription')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {showConflict && (
              <div className="space-y-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                <div className="space-y-1.5">
                  <Label htmlFor="restore-title">{t('titleLabel')}</Label>
                  <Input
                    id="restore-title"
                    value={restoreDraft.title}
                    onChange={(event) =>
                      setRestoreDraft((current) => ({
                        ...current,
                        title: event.target.value,
                      }))
                    }
                  />
                  {showConflict.titleConflictTitle && (
                    <p className="text-xs text-amber-400">
                      {t('titleConflictWithShow', {
                        title: showConflict.titleConflictTitle,
                      })}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="restore-slug">{t('slugLabel')}</Label>
                  <Input
                    id="restore-slug"
                    value={restoreDraft.slug}
                    onChange={(event) =>
                      setRestoreDraft((current) => ({
                        ...current,
                        slug: event.target.value,
                      }))
                    }
                  />
                  {showConflict.slugConflictTitle && (
                    <p className="text-xs text-amber-400">
                      {t('slugConflictWithShow', {
                        title: showConflict.slugConflictTitle,
                      })}
                    </p>
                  )}
                </div>
              </div>
            )}
            {conflicts.map((c) => (
              <div key={c.episodeId} className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 space-y-2">
                <div className="text-sm">
                  <span className="font-medium text-foreground">S{c.seasonNumber} E{c.episodeNumber}</span>
                  {' — '}
                  <span className="text-muted-foreground">{c.episodeTitle}</span>
                </div>
                <div className="text-xs text-amber-400">
                  {t('conflictsWithEpisode', { title: c.conflictingEpisodeTitle })}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground shrink-0">{t('newNumberLabel')}</span>
                  <Input
                    type="number"
                    min={1}
                    value={fixes[c.episodeId] ?? c.episodeNumber}
                    onChange={(e) => setFixes(prev => ({
                      ...prev,
                      [c.episodeId]: parseInt(e.target.value) || 1,
                    }))}
                    className="h-8 w-24"
                  />
                </div>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConflictDialogOpen(false)}
              disabled={resolving}
            >
              {tCommon('cancel')}
            </Button>
            <Button
              onClick={handleResolveAndRestore}
              disabled={resolving}
            >
              {resolving ? t('fixing') : t('fixAndRestore')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  )
}
