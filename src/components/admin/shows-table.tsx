'use client'

import { useState, useMemo } from 'react'
import { useLocale, useTranslations } from 'next-intl'
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
import { StatusBadge } from '@/components/admin/status-badge'
import { EmptyState } from '@/components/admin/empty-state'
import { ConfirmDialog } from '@/components/admin/confirm-dialog'
import { ShowFormDrawer } from '@/components/admin/show-form-drawer'
import { createShow, updateShow, archiveShow, toggleFeatured } from '@/app/[locale]/admin/actions'
import { toast } from 'sonner'
import type { Database } from '@/lib/database.types'

type Show = Database['public']['Tables']['shows']['Row']

interface ShowsTableProps {
  shows: Show[]
}

export function ShowsTable({ shows }: ShowsTableProps) {
  const tDash = useTranslations('admin.dashboard')
  const tShowForm = useTranslations('admin.showForm')
  const tCommon = useTranslations('common')
  const locale = useLocale()
  const isArabic = locale === 'ar'
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingShow, setEditingShow] = useState<Show | null>(null)
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

  function handleCreate() {
    setEditingShow(null)
    setDrawerOpen(true)
  }

  function handleEdit(show: Show) {
    setEditingShow(show)
    setDrawerOpen(true)
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

  async function handleSave(data: Parameters<typeof createShow>[0] & { id?: string }) {
    if (editingShow) {
      return updateShow(editingShow.id, data)
    }
    return createShow(data)
  }

  if (shows.length === 0) {
    return (
      <>
        <EmptyState
          heading={isArabic ? 'لا توجد برامج بعد' : 'No Shows Yet'}
          body={isArabic ? 'أنشئ برنامجك الأول للبدء.' : 'Create your first show to get started.'}
          action={<Button onClick={handleCreate}><Plus className="size-4 me-1.5" />{tDash('createShow')}</Button>}
        />
        <ShowFormDrawer open={drawerOpen} onOpenChange={setDrawerOpen} show={editingShow} onSave={handleSave} />
      </>
    )
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: isArabic ? 'إجمالي البرامج' : 'Total Shows', value: stats.total, color: 'text-foreground' },
          { label: isArabic ? 'يُبثّ الآن' : 'Streaming', value: stats.streaming, color: 'text-emerald-200' },
          { label: isArabic ? 'قريباً' : 'Coming Soon', value: stats.comingSoon, color: 'text-amber-100' },
          { label: isArabic ? 'مسودة' : 'Draft', value: stats.draft, color: 'text-muted-foreground' },
        ].map((stat) => (
          <div key={stat.label} className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4 shadow-[0_18px_48px_rgba(0,0,0,0.18)]">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{stat.label}</p>
            <p className={`mt-3 text-3xl font-semibold tracking-tight ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.24)] md:p-6">
        <div className="flex flex-col gap-4 border-b border-white/8 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
              {isArabic ? 'المكتبة' : 'Catalog'}
            </p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-foreground">
              {isArabic ? 'البرامج النشطة' : 'Active shows'}
            </h2>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative min-w-[240px] flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={isArabic ? 'بحث في البرامج…' : 'Search shows...'}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="ps-9"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-11 rounded-full border border-white/10 bg-black/20 px-4 text-sm text-foreground outline-none transition-colors focus:border-white/20"
            >
              <option value="all">{isArabic ? 'كل الحالات' : 'All Status'}</option>
              <option value="now-streaming">{isArabic ? 'يُبثّ الآن' : 'Streaming'}</option>
              <option value="coming-soon">{isArabic ? 'قريباً' : 'Coming Soon'}</option>
              <option value="draft">{isArabic ? 'مسودة' : 'Draft'}</option>
            </select>
            <Button onClick={handleCreate} className="shrink-0">
              <Plus className="me-1.5 size-4" />
              {tDash('createShow')}
            </Button>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between pb-3 text-sm text-muted-foreground">
          <span>{filtered.length} {isArabic ? 'نتيجة' : (filtered.length === 1 ? 'result' : 'results')}</span>
          <span>{isArabic ? 'مرتّبة من الأحدث' : 'Sorted by newest'}</span>
        </div>

        <div className="overflow-hidden rounded-[24px] border border-white/10 bg-black/20">
          <Table>
            <TableHeader>
              <TableRow className="bg-transparent">
                <TableHead>{isArabic ? 'البرنامج' : 'Show'}</TableHead>
                <TableHead className="hidden w-[100px] md:table-cell">{isArabic ? 'النوع' : 'Genre'}</TableHead>
                <TableHead className="w-[110px]">{isArabic ? 'الحالة' : 'Status'}</TableHead>
                <TableHead className="hidden w-[70px] sm:table-cell">{isArabic ? 'حلقات' : 'Eps'}</TableHead>
                <TableHead className="hidden w-[150px] lg:table-cell">{isArabic ? 'البث' : 'Broadcast'}</TableHead>
                <TableHead className="w-[90px] text-end">{isArabic ? 'الإجراءات' : 'Actions'}</TableHead>
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
                      {show.featured && <span className="text-amber-200">{isArabic ? 'مميّز' : 'Featured'}</span>}
                    </div>
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
                                  ? (isArabic ? `"${show.title}" ظهر في الهيرو` : `"${show.title}" featured on hero`)
                                  : (isArabic ? `"${show.title}" أُزيل من الهيرو` : `"${show.title}" removed from hero`))
                              } else {
                                toast.error(result.error ?? tCommon('error'))
                              }
                            }}
                            aria-label={show.featured
                              ? (isArabic ? `إلغاء تمييز ${show.title}` : `Unfeature ${show.title}`)
                              : (isArabic ? `تمييز ${show.title}` : `Feature ${show.title}`)}
                          >
                            <Star className={`size-4 ${show.featured ? 'fill-amber-300 text-amber-300' : ''}`} />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{show.featured ? (isArabic ? 'إزالة من الهيرو' : 'Remove from hero') : (isArabic ? 'تمييز في الهيرو' : 'Feature on hero')}</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleEdit(show)}
                            aria-label={isArabic ? `تعديل ${show.title}` : `Edit ${show.title}`}
                          >
                            <Pencil className="size-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{isArabic ? 'تعديل البرنامج' : 'Edit show'}</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleArchiveClick(show)}
                            aria-label={isArabic ? `أرشفة ${show.title}` : `Archive ${show.title}`}
                          >
                            <Archive className="size-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{isArabic ? 'أرشفة البرنامج' : 'Archive show'}</TooltipContent>
                      </Tooltip>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                    {isArabic ? 'لا توجد برامج مطابقة لبحثك' : 'No shows match your search'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <ShowFormDrawer open={drawerOpen} onOpenChange={setDrawerOpen} show={editingShow} onSave={handleSave} />

      <ConfirmDialog
        open={archiveDialogOpen}
        onOpenChange={setArchiveDialogOpen}
        title={isArabic ? 'أرشفة البرنامج' : 'Archive Show'}
        description={isArabic
          ? `سيُخفي هذا "${archivingShow?.title ?? 'هذا البرنامج'}" عن الزوار. يمكنك استعادته من قسم الأرشيف.`
          : `This will hide "${archivingShow?.title ?? 'this show'}" from all viewers. You can restore it from the Archive section.`}
        confirmLabel={isArabic ? 'أرشفة البرنامج' : 'Archive Show'}
        onConfirm={handleArchiveConfirm}
        destructive
        loading={archiving}
      />
    </TooltipProvider>
  )
}
