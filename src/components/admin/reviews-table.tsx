'use client'

import { useState, useMemo } from 'react'
import { useLocale, useTranslations } from 'next-intl'
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
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { ConfirmDialog } from '@/components/admin/confirm-dialog'
import {
  AdminPageHeader,
  AdminPanel,
  AdminTableShell,
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
  const tDash = useTranslations('admin.dashboard')
  const t = useTranslations('admin.reviews')
  const tCommon = useTranslations('common')
  const locale = useLocale()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingReview, setDeletingReview] = useState<ReviewRow | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
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
  const filteredIds = useMemo(
    () => filtered.map((review) => review.id),
    [filtered]
  )
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])
  const selectedCount = selectedIds.length
  const allFilteredSelected =
    filteredIds.length > 0 && filteredIds.every((id) => selectedSet.has(id))

  function toggleReviewSelection(reviewId: string, checked: boolean) {
    setSelectedIds((current) =>
      checked
        ? current.includes(reviewId)
          ? current
          : [...current, reviewId]
        : current.filter((id) => id !== reviewId)
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

  const handleDelete = async () => {
    if (!deletingReview) return
    setDeleting(true)
    const result = await deleteReview(deletingReview.id)
    setDeleting(false)
    setDeleteDialogOpen(false)
    if (result.success) {
      toast.success(t('toastDeleted'))
    } else {
      toast.error(result.error || t('toastDeleteFailed'))
    }
  }

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return
    const ids = selectedIds
    setBulkDeleting(true)
    for (const id of ids) {
      const result = await deleteReview(id)
      if (!result.success) {
        setBulkDeleting(false)
        toast.error(result.error || t('toastDeleteFailed'))
        return
      }
    }
    setBulkDeleting(false)
    setBulkDeleteDialogOpen(false)
    setSelectedIds([])
    toast.success(t('bulkDeletedToast', { count: ids.length }))
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
      <AdminPageHeader
        title={tDash('reviews')}
        description={tDash('totalCountLabel', { count: reviews.length })}
      />

      <AdminPanel className="overflow-hidden p-0">
        <div className="flex flex-col gap-3 border-b border-[var(--line)] p-4 sm:flex-row sm:items-center">
          <div className="relative w-full min-w-0 sm:max-w-sm sm:flex-1">
            <Search className="absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-[var(--text-mute)]" />
            <Input
              placeholder={t('searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="ps-10"
            />
          </div>
          {selectedCount > 0 && (
            <Button
              variant="destructive"
              onClick={() => setBulkDeleteDialogOpen(true)}
              className="w-full gap-2 sm:ms-auto sm:w-auto"
            >
              <Trash2 className="size-4" />
              {t('bulkDeleteButton', { count: selectedCount })}
            </Button>
          )}
        </div>

        {loadError && (
          <div className="border-brand-orange-safe/20 bg-brand-orange-safe/10 text-brand-orange-safe mx-5 mb-5 rounded-lg border px-4 py-3 text-sm md:mx-6">
            {t('loadErrorPrefix')} {loadError}
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="border-t border-[var(--line)] px-5 py-16 text-center md:px-6">
            <p className="text-muted-foreground">
              {search ? t('emptySearch') : t('empty')}
            </p>
          </div>
        ) : (
          <AdminTableShell className="rounded-none border-0">
            <Table>
              <TableHeader>
                <TableRow>
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
                      aria-label={t('selectAllAria')}
                    />
                  </TableHead>
                  <TableHead>{t('colUser')}</TableHead>
                  <TableHead>{t('colShow')}</TableHead>
                  <TableHead>{t('colRating')}</TableHead>
                  <TableHead className="hidden max-w-[300px] md:table-cell">
                    {t('colReview')}
                  </TableHead>
                  <TableHead className="hidden sm:table-cell">
                    {t('colDate')}
                  </TableHead>
                  <TableHead className="w-16 text-right">
                    {t('colActions')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow
                    key={r.id}
                    data-state={selectedSet.has(r.id) ? 'selected' : undefined}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selectedSet.has(r.id)}
                        onCheckedChange={(checked) =>
                          toggleReviewSelection(r.id, checked === true)
                        }
                        aria-label={t('selectReviewAria')}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="flex size-8 items-center justify-center rounded-full bg-[var(--bg-3)] text-[12px] font-medium text-[var(--text-dim)]">
                          {(r.profiles?.display_name || 'A')
                            .slice(0, 2)
                            .toUpperCase()}
                        </div>
                        <span>
                          {r.profiles?.display_name || t('anonymous')}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/series/${r.shows?.slug}`}
                        className="flex items-center gap-1.5 text-[var(--text-dim)] hover:text-[var(--text)]"
                      >
                        {r.shows?.title || t('unknownShow')}
                        <ExternalLink className="size-3.5" />
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Stars count={r.stars} />
                    </TableCell>
                    <TableCell className="hidden max-w-[300px] md:table-cell">
                      <p className="truncate text-[var(--text-dim)]">
                        {r.body}
                      </p>
                    </TableCell>
                    <TableCell className="hidden text-[var(--text-dim)] sm:table-cell">
                      {new Date(r.created_at).toLocaleDateString(
                        { ar: 'ar-AE', en: 'en-AE' }[locale] ?? 'en-AE',
                        {
                          month: 'short',
                          day: 'numeric',
                        }
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="destructive"
                        size="icon"
                        aria-label={t('deleteTitle')}
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
        title={t('deleteTitle')}
        description={t('deleteDescription', {
          name: deletingReview?.profiles?.display_name || t('anonymous'),
        })}
        confirmLabel={tCommon('delete')}
        destructive
        loading={deleting}
        onConfirm={handleDelete}
      />
      <ConfirmDialog
        open={bulkDeleteDialogOpen}
        onOpenChange={setBulkDeleteDialogOpen}
        title={t('bulkDeleteTitle')}
        description={t('bulkDeleteDescription', { count: selectedCount })}
        confirmLabel={tCommon('delete')}
        destructive
        loading={bulkDeleting}
        onConfirm={handleBulkDelete}
      />
    </>
  )
}
