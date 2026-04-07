'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
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
import { createShow, updateShow, archiveShow, toggleFeatured } from '@/app/admin/actions'
import { toast } from 'sonner'
import type { Database } from '@/lib/database.types'

type Show = Database['public']['Tables']['shows']['Row']

interface ShowsTableProps {
  shows: Show[]
}

export function ShowsTable({ shows }: ShowsTableProps) {
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
      toast.success(`"${archivingShow.title}" archived`)
      setArchiveDialogOpen(false)
      setArchivingShow(null)
    } else {
      toast.error(result.error ?? 'Failed to archive show')
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
          heading="No Shows Yet"
          body="Create your first show to get started."
          action={<Button onClick={handleCreate}><Plus className="size-4 mr-1.5" />Create Show</Button>}
        />
        <ShowFormDrawer open={drawerOpen} onOpenChange={setDrawerOpen} show={editingShow} onSave={handleSave} />
      </>
    )
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: 'Total Shows', value: stats.total, color: 'text-foreground' },
          { label: 'Streaming', value: stats.streaming, color: 'text-emerald-200' },
          { label: 'Coming Soon', value: stats.comingSoon, color: 'text-amber-100' },
          { label: 'Draft', value: stats.draft, color: 'text-muted-foreground' },
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
              Catalog
            </p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-foreground">
              Active shows
            </h2>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative min-w-[240px] flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search shows..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-11 rounded-full border border-white/10 bg-black/20 px-4 text-sm text-foreground outline-none transition-colors focus:border-white/20"
            >
              <option value="all">All Status</option>
              <option value="now-streaming">Streaming</option>
              <option value="coming-soon">Coming Soon</option>
              <option value="draft">Draft</option>
            </select>
            <Button onClick={handleCreate} className="shrink-0">
              <Plus className="mr-1.5 size-4" />
              Create Show
            </Button>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between pb-3 text-sm text-muted-foreground">
          <span>{filtered.length} result{filtered.length === 1 ? '' : 's'}</span>
          <span>Sorted by newest</span>
        </div>

        <div className="overflow-hidden rounded-[24px] border border-white/10 bg-black/20">
          <Table>
            <TableHeader>
              <TableRow className="bg-transparent">
                <TableHead>Show</TableHead>
                <TableHead className="hidden w-[100px] md:table-cell">Genre</TableHead>
                <TableHead className="w-[110px]">Status</TableHead>
                <TableHead className="hidden w-[70px] sm:table-cell">Eps</TableHead>
                <TableHead className="hidden w-[150px] lg:table-cell">Broadcast</TableHead>
                <TableHead className="w-[90px] text-right">Actions</TableHead>
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
                      {show.featured && <span className="text-amber-200">Featured</span>}
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
                                toast.success(result.featured ? `"${show.title}" featured on hero` : `"${show.title}" removed from hero`)
                              } else {
                                toast.error(result.error ?? 'Failed to toggle featured')
                              }
                            }}
                            aria-label={show.featured ? `Unfeature ${show.title}` : `Feature ${show.title}`}
                          >
                            <Star className={`size-4 ${show.featured ? 'fill-amber-300 text-amber-300' : ''}`} />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{show.featured ? 'Remove from hero' : 'Feature on hero'}</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleEdit(show)}
                            aria-label={`Edit ${show.title}`}
                          >
                            <Pencil className="size-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Edit show</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleArchiveClick(show)}
                            aria-label={`Archive ${show.title}`}
                          >
                            <Archive className="size-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Archive show</TooltipContent>
                      </Tooltip>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                    No shows match your search
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
        title="Archive Show"
        description={`This will hide "${archivingShow?.title ?? 'this show'}" from all viewers. You can restore it from the Archive section.`}
        confirmLabel="Archive Show"
        onConfirm={handleArchiveConfirm}
        destructive
        loading={archiving}
      />
    </TooltipProvider>
  )
}
