'use client'

import { useState, useMemo } from 'react'
import { Search, Trash2, ExternalLink } from 'lucide-react'
import { Link } from '@/i18n/navigation'

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
import {
  AdminPanel,
  AdminTableShell,
  AdminToolbar,
} from '@/components/admin/admin-shell'
import { deleteReview } from '@/app/[locale]/admin/actions'
import { toast } from 'sonner'

interface ReviewRow {
  id: string
  show_id: string
  user_id: string
  stars: number
  body: string
  created_at: string
  profiles?: { display_name: string | null; avatar_url: string | null } | null
  shows?: { title: string; slug: string } | null
}

interface ReviewsTableProps {
  reviews: ReviewRow[]
  loadError?: string | null
}

export function ReviewsTable({ reviews, loadError = null }: ReviewsTableProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingReview, setDeletingReview] = useState<ReviewRow | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!search) return reviews
    const q = search.toLowerCase()
    return reviews.filter(
      (r) =>
        r.body.toLowerCase().includes(q) ||
        r.profiles?.display_name?.toLowerCase().includes(q) ||
        r.shows?.title.toLowerCase().includes(q)
    )
  }, [reviews, search])

  const handleDelete = async () => {
    if (!deletingReview) return
    setDeleting(true)
    const result = await deleteReview(deletingReview.id)
    setDeleting(false)
    setDeleteDialogOpen(false)
    if (result.success) {
      toast.success('Review deleted')
    } else {
      toast.error(result.error || 'Failed to delete')
    }
  }

  const Stars = ({ count }: { count: number }) => (
    <div className="flex gap-0.5 text-[var(--primary)]">
      {[...Array(5)].map((_, i) => (
        <svg
          key={i}
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill={i < count ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <polygon points="12 2 15 9 22 9.3 16.5 14 18.5 21 12 17 5.5 21 7.5 14 2 9.3 9 9" />
        </svg>
      ))}
    </div>
  )

  return (
    <>
      {/* Header */}
      <AdminPanel className="p-0">
        <div className="p-5 md:p-6">
          <AdminToolbar
            eyebrow="Moderation"
            title="Reviews"
            description={`User reviews across all shows. ${reviews.length} total.`}
          >
            <div className="relative min-w-[240px] flex-1">
              <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input
                placeholder="Search reviews..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </AdminToolbar>
        </div>

        {loadError && (
          <div className="mx-5 mb-5 rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100 md:mx-6">
            Reviews could not be loaded completely. {loadError}
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="border-t border-white/8 px-5 py-16 text-center md:px-6">
            <p className="text-muted-foreground">
              {search ? 'No reviews match your search' : 'No reviews yet'}
            </p>
          </div>
        ) : (
          <AdminTableShell className="rounded-none border-x-0 border-b-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Show</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead className="max-w-[300px]">Review</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="w-16 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--bg-3)] text-[10px] font-medium text-[var(--text-dim)]">
                          {(r.profiles?.display_name || 'A')
                            .slice(0, 2)
                            .toUpperCase()}
                        </div>
                        <span className="text-sm">
                          {r.profiles?.display_name || 'Anonymous'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/series/${r.shows?.slug}`}
                        className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-sm"
                      >
                        {r.shows?.title || 'Unknown'}
                        <ExternalLink className="size-3" />
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Stars count={r.stars} />
                    </TableCell>
                    <TableCell className="max-w-[300px]">
                      <p className="text-muted-foreground truncate text-sm">
                        {r.body}
                      </p>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(r.created_at).toLocaleDateString('en-AE', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-red-400 hover:text-red-300"
                        onClick={() => {
                          setDeletingReview(r)
                          setDeleteDialogOpen(true)
                        }}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </AdminTableShell>
        )}
      </AdminPanel>

      {/* Delete confirm */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete review"
        description={`Delete this review by ${deletingReview?.profiles?.display_name || 'Anonymous'}? This cannot be undone.`}
        confirmLabel="Delete"
        destructive
        loading={deleting}
        onConfirm={handleDelete}
      />
    </>
  )
}
