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
  AdminMetric,
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
      comingSoon: displayShows.filter((s) => s.status === 'coming-soon')
        .length,
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
          <Link href="/admin/shows/new">
            <Button>
              <Plus className="me-1.5 size-4" />
              {tDash('createShow')}
            </Button>
          </Link>
        }
      />
    )
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          {
            label: tShows('totalShows'),
            value: stats.total,
            color: 'text-foreground',
          },
          {
            label: tShows('streaming'),
            value: stats.streaming,
            color: 'text-emerald-200',
          },
          {
            label: tShows('comingSoon'),
            value: stats.comingSoon,
            color: 'text-amber-100',
          },
          {
            label: tShows('draft'),
            value: stats.draft,
            color: 'text-muted-foreground',
          },
        ].map((stat) => (
          <AdminMetric
            key={stat.label}
            label={stat.label}
            value={<span className={stat.color}>{stat.value}</span>}
          />
        ))}
      </div>

      <AdminPanel>
        <div className="flex flex-col gap-4 border-b border-white/8 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-muted-foreground text-xs tracking-[0.24em] uppercase">
              {tShows('catalog')}
            </p>
            <h2 className="text-foreground mt-2 text-xl font-semibold tracking-tight">
              {tShows('activeShows')}
            </h2>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center lg:justify-end lg:gap-3">
            <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative min-w-[240px] flex-1">
                <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                <Input
                  placeholder={tShows('searchPlaceholder')}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="ps-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full min-w-[180px] shrink-0 rounded-lg border-white/8 bg-white/[0.03] sm:w-[200px]">
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
            </div>
            <Link href="/admin/shows/new" className="shrink-0">
              <Button className="w-full sm:w-auto">
                <Plus className="me-1.5 size-4" />
                {tDash('createShow')}
              </Button>
            </Link>
          </div>
        </div>

        <div className="text-muted-foreground mt-5 flex items-center justify-between pb-3 text-sm">
          <span>{tShows('resultCount', { count: filtered.length })}</span>
          {selectedCount > 0 ? (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setBulkArchiveDialogOpen(true)}
            >
              <Archive className="me-1.5 size-4" />
              {tShows('bulkArchiveButton', { count: selectedCount })}
            </Button>
          ) : (
            <span>{tShows('sortedByNewest')}</span>
          )}
        </div>

        <AdminTableShell>
          <Table>
            <TableHeader>
              <TableRow className="bg-transparent">
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
                <TableHead className="w-[110px]">
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
                  className="group transition-colors hover:bg-white/[0.02]"
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
                    <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-2 text-xs md:hidden">
                      <span>{show.genre}</span>
                      {show.featured && (
                        <span className="text-amber-200">
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
                  <TableCell>
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
                    <div className="flex items-center justify-end gap-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
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
                              className={`size-4 ${show.featured ? 'fill-amber-300 text-amber-300' : ''}`}
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
                          <Link href={`/admin/shows/${show.id}/edit`}>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={tShows('editShowAria', {
                                title: show.title,
                              })}
                            >
                              <Pencil className="size-4" />
                            </Button>
                          </Link>
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
