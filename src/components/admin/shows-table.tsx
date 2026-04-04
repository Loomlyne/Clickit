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
      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total Shows', value: stats.total, color: 'text-foreground' },
          { label: 'Streaming', value: stats.streaming, color: 'text-[#50A258]' },
          { label: 'Coming Soon', value: stats.comingSoon, color: 'text-[#EA8C2E]' },
          { label: 'Draft', value: stats.draft, color: 'text-muted-foreground' },
        ].map((stat) => (
          <div key={stat.label} className="rounded-lg border border-border bg-[var(--card)] p-4">
            <p className="text-xs text-muted-foreground">{stat.label}</p>
            <p className={`text-2xl font-semibold mt-1 ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Search + filter + create */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
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
          className="h-9 rounded-md border border-border bg-[var(--card)] px-3 text-sm text-foreground"
        >
          <option value="all">All Status</option>
          <option value="now-streaming">Streaming</option>
          <option value="coming-soon">Coming Soon</option>
          <option value="draft">Draft</option>
        </select>
        <Button onClick={handleCreate} className="shrink-0">
          <Plus className="size-4 mr-1.5" />
          Create Show
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-[var(--card)]">
              <TableHead>Show</TableHead>
              <TableHead className="w-[100px] hidden md:table-cell">Genre</TableHead>
              <TableHead className="w-[110px]">Status</TableHead>
              <TableHead className="w-[70px] hidden sm:table-cell">Eps</TableHead>
              <TableHead className="w-[150px] hidden lg:table-cell">Broadcast</TableHead>
              <TableHead className="w-[90px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((show) => (
              <TableRow key={show.id} className="group hover:bg-white/[0.02] transition-colors">
                <TableCell>
                  <Link
                    href={`/admin/shows/${show.id}`}
                    className="font-medium text-foreground hover:underline"
                  >
                    {show.title}
                  </Link>
                  <span className="block text-xs text-muted-foreground md:hidden mt-0.5">{show.genre}</span>
                </TableCell>
                <TableCell className="text-muted-foreground hidden md:table-cell">{show.genre}</TableCell>
                <TableCell>
                  <StatusBadge status={show.status} />
                </TableCell>
                <TableCell className="text-muted-foreground hidden sm:table-cell">{show.episode_count}</TableCell>
                <TableCell className="text-muted-foreground text-sm hidden lg:table-cell">
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
                          <Star className={`size-4 ${show.featured ? 'fill-yellow-400 text-yellow-400' : ''}`} />
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
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No shows match your search
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
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
