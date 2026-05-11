'use client'

import { useState, useMemo } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Plus, Search, Trash2, Pencil, ExternalLink, Star } from 'lucide-react'

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
import {
  AdminPanel,
  AdminTableShell,
} from '@/components/admin/admin-shell'
import { deleteShort, toggleShortFeatured } from '@/app/[locale]/admin/actions'
import { toast } from 'sonner'
import type { Database } from '@/lib/database.types'

type Short = Database['public']['Tables']['shorts']['Row']

interface ShortsTableProps {
  shorts: Short[]
}

export function ShortsTable({ shorts }: ShortsTableProps) {
  const tDash = useTranslations('admin.dashboard')
  const t = useTranslations('admin.shorts')
  const tCommon = useTranslations('common')
  const locale = useLocale()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingShort, setEditingShort] = useState<Short | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingShort, setDeletingShort] = useState<Short | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)
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
      toast.success(t('toastDeleted'))
    } else {
      toast.error(result.error || t('toastDeleteFailed'))
    }
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

  const isExpired = (s: Short) =>
    s.expires_at && new Date(s.expires_at) < new Date()

  const formatExpiry = (expiresAt: string | null) => {
    if (!expiresAt) return t('expiryNever')
    const d = new Date(expiresAt)
    const now = new Date()
    if (d < now) return t('expiryExpired')
    return d.toLocaleDateString(locale === 'ar' ? 'ar-AE' : 'en-AE', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  return (
    <>
      {/* Header */}
      <AdminPanel className="p-0">
        <div className="flex flex-col gap-3 border-b border-white/8 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-5 sm:py-4 md:px-6">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
              {tDash('shorts')}
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {tDash('totalCountLabel', { count: shorts.length })}
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
                  <TableHead className="w-16">{t('colThumb')}</TableHead>
                  <TableHead>{t('colTitle')}</TableHead>
                  <TableHead>{t('colGenre')}</TableHead>
                  <TableHead>{t('colExpires')}</TableHead>
                  <TableHead className="w-20 text-center">{t('colFeatured')}</TableHead>
                  <TableHead className="w-24 text-right">{t('colActions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((s) => (
                  <TableRow
                    key={s.id}
                    className={isExpired(s) ? 'opacity-50' : ''}
                  >
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
                          s.is_featured ? t('featuredRemove') : t('featuredMark')
                        }
                      >
                        <Star className={`size-3.5 ${s.is_featured ? 'fill-yellow-400' : ''}`} />
                      </Button>
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
    </>
  )
}
