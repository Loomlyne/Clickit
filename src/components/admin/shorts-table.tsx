'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Pencil,
  Plus,
  Search,
  Star,
  Trash2,
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
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { ConfirmDialog } from '@/components/admin/confirm-dialog'
import { ShortFormDrawer } from '@/components/admin/short-form-drawer'
import { AdminPanel, AdminTableShell } from '@/components/admin/admin-shell'
import {
  deleteShort,
  reorderShort,
  toggleShortFeatured,
} from '@/app/[locale]/admin/actions'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { toast } from 'sonner'
import type { Database } from '@/lib/database.types'
import { stripStorageCacheBust } from '@/lib/supabase-media'

type Short = Database['public']['Tables']['shorts']['Row']

interface ShortsTableProps {
  shorts: Short[]
}

export function ShortsTable({ shorts }: ShortsTableProps) {
  const router = useRouter()
  const tDash = useTranslations('admin.dashboard')
  const t = useTranslations('admin.shorts')
  const tCommon = useTranslations('common')
  const locale = useLocale()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingShort, setEditingShort] = useState<Short | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingShort, setDeletingShort] = useState<Short | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [displayShorts, setDisplayShorts] = useState(shorts)
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null)
  const [isReordering, startReorderTransition] = useTransition()

  useEffect(() => {
    setDisplayShorts(shorts)
  }, [shorts])

  const filtered = useMemo(() => {
    if (!search) return displayShorts
    const q = search.toLowerCase()
    return displayShorts.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.channel_name?.toLowerCase().includes(q) ||
        s.genre?.toLowerCase().includes(q)
    )
  }, [displayShorts, search])
  const filteredIds = useMemo(() => filtered.map((s) => s.id), [filtered])
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])
  const selectedCount = selectedIds.length
  const allFilteredSelected =
    filteredIds.length > 0 && filteredIds.every((id) => selectedSet.has(id))

  function toggleShortSelection(shortId: string, checked: boolean) {
    setSelectedIds((current) =>
      checked
        ? current.includes(shortId)
          ? current
          : [...current, shortId]
        : current.filter((id) => id !== shortId)
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
    if (!deletingShort) return
    setDeleting(true)
    const result = await deleteShort(deletingShort.id)
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
      const result = await deleteShort(id)
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

  const handleToggleFeatured = async (s: Short) => {
    setTogglingId(s.id)
    const next = !s.is_featured
    const result = await toggleShortFeatured(s.id, next)
    setTogglingId(null)
    if (result.success) {
      toast.success(next ? t('toastFeaturedOn') : t('toastFeaturedOff'))
    } else {
      toast.error(result.error || t('toastFeaturedFailed'))
    }
  }

  function handleReorder(shortId: string, direction: 'up' | 'down') {
    const currentIndex = filtered.findIndex((short) => short.id === shortId)
    const adjacentIndex =
      direction === 'up' ? currentIndex - 1 : currentIndex + 1
    const adjacent = filtered[adjacentIndex]
    if (!adjacent) return

    const previousShorts = displayShorts
    setPendingOrderId(shortId)
    setDisplayShorts((current) => {
      const next = [...current]
      const from = next.findIndex((short) => short.id === shortId)
      const to = next.findIndex((short) => short.id === adjacent.id)
      if (from === -1 || to === -1) return current
      const moving = next[from]!
      next[from] = next[to]!
      next[to] = moving
      return next
    })

    startReorderTransition(async () => {
      const result = await reorderShort(shortId, direction)
      setPendingOrderId(null)
      if (!result.success) {
        setDisplayShorts(previousShorts)
        toast.error(result.error ?? t('toastReorderFailed'))
        return
      }
      router.refresh()
    })
  }

  const isExpired = (s: Short) =>
    s.expires_at && new Date(s.expires_at) < new Date()

  const thumbnailSrc = (s: Short) =>
    stripStorageCacheBust(s.thumbnail_url) ||
    `https://i.ytimg.com/vi/${s.youtube_video_id}/hq720.jpg`

  const formatExpiry = (expiresAt: string | null) => {
    if (!expiresAt) return t('expiryNever')
    const d = new Date(expiresAt)
    const now = new Date()
    if (d < now) return t('expiryExpired')
    return d.toLocaleDateString(
      { ar: 'ar-AE', en: 'en-AE' }[locale] ?? 'en-AE',
      {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }
    )
  }

  return (
    <TooltipProvider delayDuration={300}>
      {/* Header */}
      <AdminPanel className="p-0">
        <div className="flex flex-col gap-3 border-b border-white/8 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-5 sm:py-4 md:px-6">
          <div className="min-w-0">
            <h2 className="text-foreground text-lg font-semibold tracking-tight sm:text-xl">
              {tDash('shorts')}
            </h2>
            <p className="text-muted-foreground mt-0.5 text-sm">
              {tDash('totalCountLabel', { count: displayShorts.length })}
            </p>
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
            <div className="relative w-full min-w-0 sm:w-[280px]">
              <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input
                placeholder={t('searchPlaceholder')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {selectedCount > 0 ? (
              <Button
                variant="destructive"
                onClick={() => setBulkDeleteDialogOpen(true)}
                className="w-full gap-2 sm:w-auto"
              >
                <Trash2 className="size-4" />
                {t('bulkDeleteButton', { count: selectedCount })}
              </Button>
            ) : (
              <Button
                onClick={() => {
                  setEditingShort(null)
                  setDrawerOpen(true)
                }}
                className="w-full gap-2 sm:w-auto"
              >
                <Plus className="size-4" />
                {t('addShort')}
              </Button>
            )}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center border-t border-white/8 px-5 py-16 text-center md:px-6">
            <p className="text-muted-foreground mb-4">
              {search ? t('emptySearch') : t('empty')}
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
                {t('addFirstShort')}
              </Button>
            )}
          </div>
        ) : (
          <AdminTableShell className="rounded-none border-x-0 border-b-0">
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
                  <TableHead className="w-16">{t('colThumb')}</TableHead>
                  <TableHead>{t('colTitle')}</TableHead>
                  <TableHead>{t('colGenre')}</TableHead>
                  <TableHead>{t('colExpires')}</TableHead>
                  <TableHead className="w-20 text-center">
                    {t('colFeatured')}
                  </TableHead>
                  <TableHead className="w-36 text-right">
                    {t('colActions')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((s, index) => (
                  <TableRow
                    key={s.id}
                    className={isExpired(s) ? 'opacity-50' : ''}
                    data-state={selectedSet.has(s.id) ? 'selected' : undefined}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selectedSet.has(s.id)}
                        onCheckedChange={(checked) =>
                          toggleShortSelection(s.id, checked === true)
                        }
                        aria-label={t('selectShortAria', { title: s.title })}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="relative h-10 w-7 overflow-hidden rounded bg-white/5">
                        <Image
                          src={thumbnailSrc(s)}
                          alt={s.title}
                          fill
                          sizes="28px"
                          className="object-cover"
                        />
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      <div className="flex max-w-[200px] items-start gap-2 md:max-w-[360px]">
                        <span className="line-clamp-2 break-words">
                          {s.title}
                        </span>
                        <a
                          href={`https://youtube.com/shorts/${s.youtube_video_id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-muted-foreground hover:text-foreground mt-0.5 shrink-0"
                        >
                          <ExternalLink className="size-3" />
                        </a>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {s.genre || '—'}
                    </TableCell>
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
                    <TableCell className="text-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`size-8 ${s.is_featured ? 'text-yellow-400 hover:text-yellow-300' : 'text-muted-foreground hover:text-yellow-400'}`}
                        disabled={togglingId === s.id}
                        onClick={() => handleToggleFeatured(s)}
                        title={
                          s.is_featured
                            ? t('featuredRemove')
                            : t('featuredMark')
                        }
                      >
                        <Star
                          className={`size-3.5 ${s.is_featured ? 'fill-yellow-400' : ''}`}
                        />
                      </Button>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              disabled={
                                isReordering ||
                                pendingOrderId === s.id ||
                                index === 0
                              }
                              onClick={() => handleReorder(s.id, 'up')}
                              aria-label={t('moveUpAria', { title: s.title })}
                            >
                              <ChevronUp className="size-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>{t('moveUp')}</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              disabled={
                                isReordering ||
                                pendingOrderId === s.id ||
                                index === filtered.length - 1
                              }
                              onClick={() => handleReorder(s.id, 'down')}
                              aria-label={t('moveDownAria', {
                                title: s.title,
                              })}
                            >
                              <ChevronDown className="size-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>{t('moveDown')}</TooltipContent>
                        </Tooltip>
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
          </AdminTableShell>
        )}
      </AdminPanel>

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
        title={t('deleteTitle')}
        description={t('deleteDescription', {
          title: deletingShort?.title ?? '',
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
    </TooltipProvider>
  )
}
