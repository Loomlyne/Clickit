'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { RotateCcw, Trash2 } from 'lucide-react'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { ConfirmDialog } from '@/components/admin/confirm-dialog'
import { AdminPanel, AdminTableShell } from '@/components/admin/admin-shell'
import {
  restoreEpisode,
  deleteEpisodePermanently,
} from '@/app/[locale]/admin/actions'
import { toast } from 'sonner'

export interface ArchivedEpisode {
  id: string
  title: string
  episodeNumber: number
  seasonNumber: number | null
  showTitle: string
  showId: string
  updatedAt: string
}

const DATE_LOCALES: Record<string, string> = {
  ar: 'ar-AE-u-nu-latn',
  en: 'en-US',
}

function formatDate(dateString: string, locale: string): string {
  return new Date(dateString).toLocaleDateString(
    DATE_LOCALES[locale] ?? DATE_LOCALES.en,
    { year: 'numeric', month: 'short', day: 'numeric' }
  )
}

interface ArchiveEpisodesTableProps {
  episodes: ArchivedEpisode[]
}

export function ArchiveEpisodesTable({ episodes }: ArchiveEpisodesTableProps) {
  const t = useTranslations('admin.archive')
  const tCommon = useTranslations('common')
  const locale = useLocale()
  const [restoring, setRestoring] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingEpisode, setDeletingEpisode] = useState<ArchivedEpisode | null>(
    null
  )
  const [deleting, setDeleting] = useState(false)

  if (episodes.length === 0) return null

  async function handleRestore(episode: ArchivedEpisode) {
    setRestoring(episode.id)
    const result = await restoreEpisode(episode.id)
    setRestoring(null)
    if (result.success) {
      toast.success(t('episodeRestoredToast'))
    } else {
      toast.error(result.error ?? tCommon('error'))
    }
  }

  async function handleDeleteConfirm() {
    if (!deletingEpisode) return
    setDeleting(true)
    const result = await deleteEpisodePermanently(deletingEpisode.id)
    setDeleting(false)
    if (result.success) {
      toast.success(t('episodeDeletedToast'))
      setDeleteDialogOpen(false)
      setDeletingEpisode(null)
    } else {
      toast.error(result.error ?? tCommon('error'))
    }
  }

  return (
    <TooltipProvider delayDuration={300}>
      <AdminPanel>
        <div className="pb-4">
          <h2 className="text-foreground text-lg font-semibold tracking-tight">
            {t('episodesSectionTitle')}
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            {t('episodesSectionDescription')}
          </p>
          <p className="text-muted-foreground mt-2 text-sm">
            {t('archivedEpisodesCount', { count: episodes.length })}
          </p>
        </div>

        <AdminTableShell>
          <Table>
            <TableHeader>
              <TableRow className="bg-transparent">
                <TableHead>{t('episodeColumn')}</TableHead>
                <TableHead className="hidden sm:table-cell">
                  {t('showColumn')}
                </TableHead>
                <TableHead className="hidden w-[130px] md:table-cell">
                  {t('archivedColumn')}
                </TableHead>
                <TableHead className="w-[180px] text-end">
                  {t('actionsColumn')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {episodes.map((episode) => (
                <TableRow
                  key={episode.id}
                  className="group transition-colors hover:bg-white/[0.02]"
                >
                  <TableCell>
                    <span className="text-muted-foreground me-2 text-xs">
                      {episode.seasonNumber != null
                        ? `S${episode.seasonNumber} E${episode.episodeNumber}`
                        : `E${episode.episodeNumber}`}
                    </span>
                    <span className="font-medium">{episode.title}</span>
                    <span className="text-muted-foreground mt-0.5 block text-xs sm:hidden">
                      {episode.showTitle}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground hidden sm:table-cell">
                    {episode.showTitle}
                  </TableCell>
                  <TableCell className="text-muted-foreground hidden text-sm md:table-cell">
                    {formatDate(episode.updatedAt, locale)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRestore(episode)}
                            disabled={restoring === episode.id}
                          >
                            <RotateCcw className="me-1 size-3.5" />
                            {restoring === episode.id
                              ? t('restoring')
                              : t('restoreButton')}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {t('restoreEpisodeTooltip')}
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                              setDeletingEpisode(episode)
                              setDeleteDialogOpen(true)
                            }}
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
        title={t('deleteEpisodeTitle')}
        description={t('deleteEpisodeDescription', {
          title: deletingEpisode?.title ?? t('thisEpisode'),
        })}
        confirmLabel={t('deletePermanentlyButton')}
        onConfirm={handleDeleteConfirm}
        destructive
        loading={deleting}
      />
    </TooltipProvider>
  )
}
