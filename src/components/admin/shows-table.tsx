'use client'

import { useState, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { Pencil, Archive, Plus, Search, Star } from 'lucide-react'

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
import { AdminMetric, AdminPanel, AdminTableShell } from '@/components/admin/admin-shell'
import { StatusBadge } from '@/components/admin/status-badge'
import { EmptyState } from '@/components/admin/empty-state'
import { ConfirmDialog } from '@/components/admin/confirm-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AdminCategoryBadge } from '@/components/admin/admin-category-badge'
import { archiveShow, toggleFeatured } from '@/app/[locale]/admin/actions'
import { toast } from 'sonner'
import type { Database } from '@/lib/database.types'

type Show = Database['public']['Tables']['shows']['Row']

interface ShowsTableProps {
  shows: Show[]
  categoriesByShowId: Record<string, { name: string; slug: string; color: string | null }[]>
}

export function ShowsTable({ shows, categoriesByShowId }: ShowsTableProps) {
  const tDash = useTranslations('admin.dashboard')
  const tShowForm = useTranslations('admin.showForm')
  const tShows = useTranslations('admin.shows')
  const tCommon = useTranslations('common')
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false)
  const [archivingShow, setArchivingShow] = useState<Show | null>(null)
  const [archiving, setArchiving] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  // Filtered shows
  const filtered = useMemo(() => {
    let result = shows
    if (search) {
      const q = search.toLowerCase()
      result = result.filter((s) => s.title.toLowerCase().includes(q) || s.genre?.toLowerCase().includes(q))
    }
    if (statusFilter !== 'all') {
      result = result.filter((s) => s.status === statusFilter)
    }
    return result
  }, [shows, search, statusFilter])

  // Stats
  const stats = useMemo(() => ({
    total: shows.length,
    streaming: shows.filter((s) => s.status === 'now-streaming').length,
    comingSoon: shows.filter((s) => s.status === 'coming-soon').length,
    draft: shows.filter((s) => s.status === 'draft').length,
  }), [shows])

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

  if (shows.length === 0) {
    return (
      <EmptyState
        heading={tShows('emptyHeading')}
        body={tShows('emptyBody')}
        action={<Link href="/admin/shows/new"><Button><Plus className="size-4 me-1.5" />{tDash('createShow')}</Button></Link>}
      />
    )
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: tShows('totalShows'), value: stats.total, color: 'text-foreground' },
          { label: tShows('streaming'), value: stats.streaming, color: 'text-emerald-200' },
          { label: tShows('comingSoon'), value: stats.comingSoon, color: 'text-amber-100' },
          { label: tShows('draft'), value: stats.draft, color: 'text-muted-foreground' },
        ].map((stat) => (
          <AdminMetric key={stat.label} label={stat.label} value={<span className={stat.color}>{stat.value}</span>} />
        ))}
      </div>

      <AdminPanel>
        <div className="flex flex-col gap-4 border-b border-white/8 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
              {tShows('catalog')}
            </p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-foreground">
              {tShows('activeShows')}
            </h2>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center lg:justify-end lg:gap-3">
            <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative min-w-[240px] flex-1">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder={tShows('searchPlaceholder')}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="ps-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full min-w-[180px] sm:w-[200px] shrink-0 rounded-full border-white/8 bg-white/[0.03]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{tShows('allStatus')}</SelectItem>
                  <SelectItem value="now-streaming">{tShows('streaming')}</SelectItem>
                  <SelectItem value="coming-soon">{tShows('comingSoon')}</SelectItem>
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

        <div className="mt-5 flex items-center justify-between pb-3 text-sm text-muted-foreground">
          <span>{tShows('resultCount', { count: filtered.length })}</span>
          <span>{tShows('sortedByNewest')}</span>
        </div>

        <AdminTableShell>
          <Table>
            <TableHeader>
              <TableRow className="bg-transparent">
                <TableHead>{tShows('showColumn')}</TableHead>
                <TableHead className="hidden w-[100px] md:table-cell">{tShows('genreColumn')}</TableHead>
                <TableHead className="w-[110px]">{tShows('statusColumn')}</TableHead>
                <TableHead className="hidden w-[70px] sm:table-cell">{tShows('episodesColumn')}</TableHead>
                <TableHead className="hidden w-[150px] lg:table-cell">{tShows('broadcastColumn')}</TableHead>
                <TableHead className="w-[90px] text-end">{tShows('actionsColumn')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((show) => (
                <TableRow key={show.id} className="group transition-colors hover:bg-white/[0.02]">
                  <TableCell>
                    <Link
                      href={`/admin/shows/${show.id}`}
                      className="font-medium text-foreground transition-colors hover:text-primary"
                    >
                      {show.title}
                    </Link>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground md:hidden">
                      <span>{show.genre}</span>
                      {show.featured && <span className="text-amber-200">{tShows('featured')}</span>}
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
                  <TableCell className="hidden text-muted-foreground md:table-cell">{show.genre}</TableCell>
                  <TableCell>
                    <StatusBadge status={show.status} />
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground sm:table-cell">{show.episode_count}</TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">
                    {show.broadcast_day && show.broadcast_time
                      ? `${show.broadcast_day} ${show.broadcast_time}`
                      : '---'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={async () => {
                              const result = await toggleFeatured(show.id)
                              if (result.success) {
                                toast.success(result.featured
                                  ? tShows('featuredToast', { title: show.title })
                                  : tShows('unfeaturedToast', { title: show.title }))
                              } else {
                                toast.error(result.error ?? tCommon('error'))
                              }
                            }}
                            aria-label={show.featured
                              ? tShows('unfeatureAria', { title: show.title })
                              : tShows('featureAria', { title: show.title })}
                          >
                            <Star className={`size-4 ${show.featured ? 'fill-amber-300 text-amber-300' : ''}`} />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{show.featured ? tShows('removeFromHero') : tShows('featureOnHero')}</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Link href={`/admin/shows/${show.id}/edit`}>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={tShows('editShowAria', { title: show.title })}
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
                            aria-label={tShows('archiveShowAria', { title: show.title })}
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
                  <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
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
        description={tShows('archiveDialogDescription', { title: archivingShow?.title ?? tShows('thisShow') })}
        confirmLabel={tShows('archiveDialogTitle')}
        onConfirm={handleArchiveConfirm}
        destructive
        loading={archiving}
      />
    </TooltipProvider>
  )
}
