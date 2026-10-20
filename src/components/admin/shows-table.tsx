'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import {
  Archive,
  ChevronDown,
  ChevronUp,
  Pencil,
  Plus,
  Search,
  Star,
} from 'lucide-react'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  AdminMetricStrip,
  AdminPanel,
  AdminTableShell,
} from '@/components/admin/admin-shell'
import { StatusBadge } from '@/components/admin/status-badge'
import { EmptyState } from '@/components/admin/empty-state'
import { ConfirmDialog } from '@/components/admin/confirm-dialog'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AdminCategoryBadge } from '@/components/admin/admin-category-badge'
import {
  archiveShow,
  reorderShow,
  toggleFeatured,
} from '@/app/[locale]/admin/actions'
import { toast } from 'sonner'
import type { Database } from '@/lib/database.types'

type Show = Database['public']['Tables']['shows']['Row']

interface ShowsTableProps {
  shows: Show[]
  categoriesByShowId: Record<
    string,
    { name: string; slug: string; color: string | null }[]
  >
}

export function ShowsTable({ shows, categoriesByShowId }: ShowsTableProps) {
  const router = useRouter()
  const tDash = useTranslations('admin.dashboard')
  const tShowForm = useTranslations('admin.showForm')
  const tShows = useTranslations('admin.shows')
  const tCommon = useTranslations('common')
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false)
  const [bulkArchiveDialogOpen, setBulkArchiveDialogOpen] = useState(false)
  const [archivingShow, setArchivingShow] = useState<Show | null>(null)
  const [archiving, setArchiving] = useState(false)
  const [bulkArchiving, setBulkArchiving] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [displayShows, setDisplayShows] = useState(shows)
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null)
  const [isReordering, startReorderTransition] = useTransition()

  useEffect(() => {
    setDisplayShows(shows)
  }, [shows])

  // Filtered shows
  const filtered = useMemo(() => {
    let result = displayShows
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          s.genre?.toLowerCase().includes(q)
      )
    }
    if (statusFilter !== 'all') {
      result = result.filter((s) => s.status === statusFilter)
    }
    return result
  }, [displayShows, search, statusFilter])

  // Stats
  const stats = useMemo(
    () => ({
      total: displayShows.length,
      streaming: displayShows.filter((s) => s.status === 'now-streaming')
        .length,
      comingSoon: displayShows.filter((s) => s.status === 'coming-soon').length,
      draft: displayShows.filter((s) => s.status === 'draft').length,
    }),
    [displayShows]
  )
  const filteredIds = useMemo(() => filtered.map((show) => show.id), [filtered])
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])
  const selectedCount = selectedIds.length
  const allFilteredSelected =
    filteredIds.length > 0 && filteredIds.every((id) => selectedSet.has(id))

  useEffect(() => {
    setSelectedIds((current) =>
      current.filter((id) => displayShows.some((show) => show.id === id))
    )
  }, [displayShows])

  function toggleShowSelection(showId: string, checked: boolean) {
    setSelectedIds((current) =>
      checked
        ? current.includes(showId)
          ? current
          : [...current, showId]
        : current.filter((id) => id !== showId)
    )
  }

  function toggleFilteredSelection(checked: boolean) {
    setSelectedIds((current) => {
      if (!checked) return current.filter((id) => !filteredIds.includes(id))
      const next = new Set(current)
      for (const id of filteredIds) next.add(id)
      return Array.from(next)
    })
  }

  function handleArchiveClick(show: Show) {
    setArchivingShow(show)
    setArchiveDialogOpen(true)
  }

  async function handleArchiveConfirm() {
    if (!archivingShow) return
    setArchiving(true)
    const result = await archiveShow(archivingShow.id)
    setArchiving(false)
    if (result.success) {
      toast.success(tShowForm('showArchived'))
      setArchiveDialogOpen(false)
      setArchivingShow(null)
    } else {
      toast.error(result.error ?? tCommon('error'))
    }
  }

  async function handleBulkArchiveConfirm() {
    if (selectedIds.length === 0) return
    setBulkArchiving(true)
    for (const id of selectedIds) {
      const result = await archiveShow(id)
      if (!result.success) {
        setBulkArchiving(false)
        toast.error(result.error ?? tCommon('error'))
        return
      }
    }
    setBulkArchiving(false)
    setBulkArchiveDialogOpen(false)
    setSelectedIds([])
    toast.success(tShows('bulkArchiveToast', { count: selectedCount }))
    router.refresh()
  }

  function handleReorder(showId: string, direction: 'up' | 'down') {
    const currentIndex = filtered.findIndex((show) => show.id === showId)
    const adjacentIndex =
      direction === 'up' ? currentIndex - 1 : currentIndex + 1
    const adjacent = filtered[adjacentIndex]
    if (!adjacent) return

    const previousShows = displayShows
    setPendingOrderId(showId)
    setDisplayShows((current) => {
      const next = [...current]
      const from = next.findIndex((show) => show.id === showId)
      const to = next.findIndex((show) => show.id === adjacent.id)
      if (from === -1 || to === -1) return current
      const moving = next[from]!
      next[from] = next[to]!
      next[to] = moving
      return next
    })

    startReorderTransition(async () => {
      const result = await reorderShow(showId, direction)
      setPendingOrderId(null)
      if (!result.success) {
        setDisplayShows(previousShows)
        toast.error(result.error ?? tShows('toastReorderFailed'))
        return
      }
      router.refresh()
    })
  }

  if (displayShows.length === 0) {
    return (
      <EmptyState
        heading={tShows('emptyHeading')}
        body={tShows('emptyBody')}
        action={
          <Button asChild>
            <Link href="/admin/shows/new">
              <Plus className="me-1.5 size-4" />
              {tDash('createShow')}
            </Link>
          </Button>
        }
      />
    )
  }

  return (
    <TooltipProvider delayDuration={300}>
      <AdminMetricStrip
        items={[
          { label: tShows('totalShows'), value: stats.total },
          {
            label: tShows('streaming'),
            value: stats.streaming,
            className: 'text-brand-green-safe',
          },
          {
            label: tShows('comingSoon'),
            value: stats.comingSoon,
            className: 'text-brand-orange-safe',
          },
          {
            label: tShows('draft'),
            value: stats.draft,
            className: 'text-[var(--text-dim)]',
          },
        ]}
      />

      <AdminPanel className="overflow-hidden p-0">
        <div className="flex flex-col gap-3 border-b border-[var(--line)] p-4 sm:flex-row sm:items-center">
          <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
            <Search className="absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-[var(--text-mute)]" />
            <Input
              placeholder={tShows('searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="ps-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full shrink-0 sm:w-[190px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{tShows('allStatus')}</SelectItem>
              <SelectItem value="now-streaming">
                {tShows('streaming')}
              </SelectItem>
              <SelectItem value="coming-soon">
                {tShows('comingSoon')}
              </SelectItem>
              <SelectItem value="draft">{tShows('draft')}</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center justify-between gap-3 text-[13px] text-[var(--text-mute)] sm:ms-auto">
            <span>
              {tShows('resultCount', { count: filtered.length })}
              {selectedCount === 0 ? ` · ${tShows('sortedByNewest')}` : ''}
            </span>
            {selectedCount > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setBulkArchiveDialogOpen(true)}
              >
                <Archive className="size-4" />
                {tShows('bulkArchiveButton', { count: selectedCount })}
              </Button>
            )}
          </div>
        </div>

        <AdminTableShell className="rounded-none border-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-transparent hover:bg-transparent">
                <TableHead className="w-10">
                  <Checkbox
                    checked={
                      allFilteredSelected
                        ? true
                        : selectedIds.some((id) => filteredIds.includes(id))
                          ? 'indeterminate'
                          : false
                    }
                    onCheckedChange={(checked) =>
                      toggleFilteredSelection(checked === true)
                    }
                    aria-label={tShows('selectAllAria')}
                  />
                </TableHead>
                <TableHead>{tShows('showColumn')}</TableHead>
                <TableHead className="hidden w-[100px] md:table-cell">
                  {tShows('genreColumn')}
                </TableHead>
                <TableHead className="hidden w-[110px] sm:table-cell">
                  {tShows('statusColumn')}
                </TableHead>
                <TableHead className="hidden w-[70px] sm:table-cell">
                  {tShows('episodesColumn')}
                </TableHead>
                <TableHead className="hidden w-[150px] lg:table-cell">
                  {tShows('broadcastColumn')}
                </TableHead>
                <TableHead className="w-[132px] text-end">
                  {tShows('actionsColumn')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((show, index) => (
                <TableRow
                  key={show.id}
                  className="group transition-colors hover:bg-[var(--bg-2)]"
                  data-state={selectedSet.has(show.id) ? 'selected' : undefined}
                >
                  <TableCell>
                    <Checkbox
                      checked={selectedSet.has(show.id)}
                      onCheckedChange={(checked) =>
                        toggleShowSelection(show.id, checked === true)
                      }
                      aria-label={tShows('selectShowAria', {
                        title: show.title,
                      })}
                    />
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/admin/shows/${show.id}`}
                      className="text-foreground hover:text-primary font-medium transition-colors"
                    >
                      {show.title}
                    </Link>
                    <div className="mt-2 sm:hidden">
                      <StatusBadge status={show.status} />
                    </div>
                    <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-2 text-xs md:hidden">
                      <span>{show.genre}</span>
                      {show.featured && (
                        <span className="text-[var(--primary)]">
                          {tShows('featured')}
                        </span>
                      )}
                    </div>
                    {(categoriesByShowId[show.id] ?? []).length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {categoriesByShowId[show.id].map((category) => (
                          <AdminCategoryBadge
                            key={`${show.id}-${category.slug}`}
                            name={category.name}
                            color={category.color}
                          />
                        ))}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground hidden md:table-cell">
                    {show.genre}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <StatusBadge status={show.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground hidden sm:table-cell">
                    {show.episode_count}
                  </TableCell>
                  <TableCell className="text-muted-foreground hidden text-sm lg:table-cell">
                    {show.broadcast_day?.length && show.broadcast_time
                      ? `${show.broadcast_day.join(', ')} ${show.broadcast_time}`
                      : '---'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            className="max-md:hidden"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleReorder(show.id, 'up')}
                            disabled={
                              isReordering ||
                              pendingOrderId === show.id ||
                              index === 0
                            }
                            aria-label={tShows('moveUpAria', {
                              title: show.title,
                            })}
                          >
                            <ChevronUp className="size-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{tShows('moveUp')}</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            className="max-md:hidden"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleReorder(show.id, 'down')}
                            disabled={
                              isReordering ||
                              pendingOrderId === show.id ||
                              index === filtered.length - 1
                            }
                            aria-label={tShows('moveDownAria', {
                              title: show.title,
                            })}
                          >
                            <ChevronDown className="size-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{tShows('moveDown')}</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={async () => {
                              const result = await toggleFeatured(show.id)
                              if (result.success) {
                                toast.success(
                                  result.featured
                                    ? tShows('featuredToast', {
                                        title: show.title,
                                      })
                                    : tShows('unfeaturedToast', {
                                        title: show.title,
                                      })
                                )
                              } else {
                                toast.error(result.error ?? tCommon('error'))
                              }
                            }}
                            aria-label={
                              show.featured
                                ? tShows('unfeatureAria', { title: show.title })
                                : tShows('featureAria', { title: show.title })
                            }
                          >
                            <Star
                              className={`size-4 ${show.featured ? 'fill-[var(--primary)] text-[var(--primary)]' : ''}`}
                            />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {show.featured
                            ? tShows('removeFromHero')
                            : tShows('featureOnHero')}
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            asChild
                            variant="ghost"
                            size="icon-sm"
                            aria-label={tShows('editShowAria', {
                              title: show.title,
                            })}
                          >
                            <Link href={`/admin/shows/${show.id}/edit`}>
                              <Pencil className="size-4" />
                            </Link>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{tShows('editShow')}</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleArchiveClick(show)}
                            aria-label={tShows('archiveShowAria', {
                              title: show.title,
                            })}
                          >
                            <Archive className="size-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{tShows('archiveShow')}</TooltipContent>
                      </Tooltip>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-muted-foreground py-10 text-center"
                  >
                    {tShows('noSearchMatches')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </AdminTableShell>
      </AdminPanel>

      <ConfirmDialog
        open={archiveDialogOpen}
        onOpenChange={setArchiveDialogOpen}
        title={tShows('archiveDialogTitle')}
        description={tShows('archiveDialogDescription', {
          title: archivingShow?.title ?? tShows('thisShow'),
        })}
        confirmLabel={tShows('archiveDialogTitle')}
        onConfirm={handleArchiveConfirm}
        destructive
        loading={archiving}
      />
      <ConfirmDialog
        open={bulkArchiveDialogOpen}
        onOpenChange={setBulkArchiveDialogOpen}
        title={tShows('bulkArchiveTitle')}
        description={tShows('bulkArchiveDescription', {
          count: selectedCount,
        })}
        confirmLabel={tShows('bulkArchiveConfirm')}
        onConfirm={handleBulkArchiveConfirm}
        destructive
        loading={bulkArchiving}
      />
    </TooltipProvider>
  )
}
