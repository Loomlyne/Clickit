'use client'

import { useState, useMemo } from 'react'
import { Plus, Search, Trash2, Pencil, ExternalLink } from 'lucide-react'

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
import { ConfirmDialog } from '@/components/admin/confirm-dialog'
import { ShortFormDrawer } from '@/components/admin/short-form-drawer'
import { deleteShort } from '@/app/[locale]/admin/actions'
import { toast } from 'sonner'
import type { Database } from '@/lib/database.types'

type Short = Database['public']['Tables']['shorts']['Row']

interface ShortsTableProps {
  shorts: Short[]
}

export function ShortsTable({ shorts }: ShortsTableProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingShort, setEditingShort] = useState<Short | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingShort, setDeletingShort] = useState<Short | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!search) return shorts
    const q = search.toLowerCase()
    return shorts.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.channel_name?.toLowerCase().includes(q) ||
        s.genre?.toLowerCase().includes(q)
    )
  }, [shorts, search])

  const handleDelete = async () => {
    if (!deletingShort) return
    setDeleting(true)
    const result = await deleteShort(deletingShort.id)
    setDeleting(false)
    setDeleteDialogOpen(false)
    if (result.success) {
      toast.success('Short deleted')
    } else {
      toast.error(result.error || 'Failed to delete')
    }
  }

  const isExpired = (s: Short) =>
    s.expires_at && new Date(s.expires_at) < new Date()

  const formatExpiry = (expiresAt: string | null) => {
    if (!expiresAt) return 'Never'
    const d = new Date(expiresAt)
    const now = new Date()
    if (d < now) return 'Expired'
    return d.toLocaleDateString('en-AE', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Quick Bites</h1>
          <p className="text-sm text-muted-foreground">
            YouTube Shorts that appear on the browse page. {shorts.length} total.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingShort(null)
            setDrawerOpen(true)
          }}
          className="gap-2"
        >
          <Plus className="size-4" />
          Add Short
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search shorts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-white/10 py-16 text-center">
          <p className="text-muted-foreground mb-4">
            {search ? 'No shorts match your search' : 'No shorts yet'}
          </p>
          {!search && (
            <Button
              variant="outline"
              onClick={() => {
                setEditingShort(null)
                setDrawerOpen(true)
              }}
              className="gap-2"
            >
              <Plus className="size-4" />
              Add your first short
            </Button>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-white/8 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Thumb</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>Genre</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead className="w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((s) => (
                <TableRow key={s.id} className={isExpired(s) ? 'opacity-50' : ''}>
                  <TableCell>
                    {s.thumbnail_url ? (
                      <img
                        src={s.thumbnail_url}
                        alt=""
                        className="h-10 w-7 rounded object-cover"
                      />
                    ) : (
                      <div className="h-10 w-7 rounded bg-white/5" />
                    )}
                  </TableCell>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {s.title}
                      <a
                        href={`https://youtube.com/shorts/${s.youtube_video_id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <ExternalLink className="size-3" />
                      </a>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {s.channel_name || '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {s.genre || '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{s.sort_order}</TableCell>
                  <TableCell>
                    <span
                      className={
                        isExpired(s)
                          ? 'text-red-400'
                          : 'text-muted-foreground'
                      }
                    >
                      {formatExpiry(s.expires_at)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={() => {
                          setEditingShort(s)
                          setDrawerOpen(true)
                        }}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-red-400 hover:text-red-300"
                        onClick={() => {
                          setDeletingShort(s)
                          setDeleteDialogOpen(true)
                        }}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Form drawer */}
      <ShortFormDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        editingShort={editingShort}
      />

      {/* Delete confirm */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete short"
        description={`Permanently delete "${deletingShort?.title}"? This cannot be undone.`}
        confirmLabel="Delete"
        destructive
        loading={deleting}
        onConfirm={handleDelete}
      />
    </>
  )
}
