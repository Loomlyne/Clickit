'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { Plus, Trash2, Loader2, Camera, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  addCastMember,
  deleteCastMember,
  uploadCastImage,
} from '@/app/[locale]/admin/actions'
import { toast } from 'sonner'
import type { Database } from '@/lib/database.types'
import { stripStorageCacheBust } from '@/lib/supabase-media'

type CastMember = Database['public']['Tables']['show_cast']['Row']

interface CastEditorProps {
  showId: string
  cast: CastMember[]
}

export function CastEditor({ showId, cast: initialCast }: CastEditorProps) {
  const t = useTranslations('admin.castEditor')
  const tCommon = useTranslations('common')
  const [cast, setCast] = useState(initialCast)
  const [adding, setAdding] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    return () => {
      if (imagePreview?.startsWith('blob:')) URL.revokeObjectURL(imagePreview)
    }
  }, [imagePreview])

  const resetForm = () => {
    if (imagePreview?.startsWith('blob:')) URL.revokeObjectURL(imagePreview)
    setName('')
    setRole('')
    setImageFile(null)
    setImagePreview(null)
    setFormOpen(false)
  }

  const handleAdd = async () => {
    if (!name.trim()) return
    setAdding(true)
    let uploadedImageUrl: string | null = null

    if (imageFile) {
      const formData = new FormData()
      formData.set('file', imageFile)
      formData.set('showId', showId)
      const uploadResult = await uploadCastImage(formData)
      if (!uploadResult.success) {
        setAdding(false)
        toast.error(uploadResult.error || t('toastImageUploadFailed'))
        return
      }
      uploadedImageUrl = uploadResult.data ?? null
    }

    const result = await addCastMember({
      show_id: showId,
      name: name.trim(),
      role: role.trim() || null,
      image_url: uploadedImageUrl,
      sort_order: cast.length,
    })
    setAdding(false)
    if (result.success && result.data) {
      setCast((prev) => [...prev, result.data as CastMember])
      resetForm()
      toast.success(t('toastMemberAdded'))
    } else {
      toast.error(result.error || t('toastAddFailed'))
    }
  }

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      toast.error(t('toastInvalidImage'))
      event.target.value = ''
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error(t('toastImageTooLarge'))
      event.target.value = ''
      return
    }

    if (imagePreview?.startsWith('blob:')) URL.revokeObjectURL(imagePreview)
    const previewUrl = URL.createObjectURL(file)
    setImageFile(file)
    setImagePreview(previewUrl)
    event.target.value = ''
  }

  const clearImage = () => {
    if (imagePreview?.startsWith('blob:')) URL.revokeObjectURL(imagePreview)
    setImageFile(null)
    setImagePreview(null)
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    const result = await deleteCastMember(id)
    setDeletingId(null)
    if (result.success) {
      setCast((prev) => prev.filter((c) => c.id !== id))
      toast.success(t('toastMemberRemoved'))
    } else {
      toast.error(result.error || t('toastRemoveFailed'))
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">{t('heading')}</h3>
          <p className="text-muted-foreground text-xs">
            {t('membersCount', { count: cast.length })}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setFormOpen(!formOpen)}
          className="gap-1.5"
        >
          <Plus className="size-3.5" />
          {t('add')}
        </Button>
      </div>

      {/* Add form */}
      {formOpen && (
        <div className="mb-4 space-y-3 rounded-lg border border-[var(--line)] bg-[var(--bg-2)] p-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-start">
            <div className="flex justify-center md:block">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="group relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--line-2)] transition-all hover:border-[var(--text-mute)]"
                  style={{
                    background: imagePreview ? undefined : 'var(--bg-3)',
                  }}
                >
                  {imagePreview ? (
                    <Image
                      src={imagePreview}
                      alt={t('previewAlt')}
                      fill
                      unoptimized
                      className="object-cover"
                    />
                  ) : (
                    <span className="text-2xl font-semibold text-[var(--text)]">
                      {name.trim().slice(0, 1).toUpperCase() || '?'}
                    </span>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                    {adding ? (
                      <Loader2 className="size-5 animate-spin text-[var(--text)]" />
                    ) : (
                      <Camera className="size-5 text-[var(--text)]" />
                    )}
                  </div>
                </button>
                {imagePreview && (
                  <button
                    type="button"
                    onClick={clearImage}
                    className="absolute -end-5 -top-5 flex size-9 items-center justify-center rounded-full bg-black/70 text-[var(--text)] transition-colors hover:bg-black"
                    aria-label={t('removeImageAria')}
                  >
                    <X className="size-3.5" />
                  </button>
                )}
                <input
                  ref={inputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={handleImageChange}
                />
              </div>
            </div>

            <div className="grid flex-1 gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">{t('nameLabel')}</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('namePlaceholder')}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t('roleLabel')}</Label>
                <Input
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder={t('rolePlaceholder')}
                />
              </div>
              <div className="md:col-span-2">
                <p className="text-xs text-[var(--text-mute)]">
                  {t('uploadHint')}
                </p>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={!name.trim() || adding}
            >
              {adding ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                t('addMember')
              )}
            </Button>
            <Button size="sm" variant="ghost" onClick={resetForm}>
              {tCommon('cancel')}
            </Button>
          </div>
        </div>
      )}

      {/* Cast grid */}
      {cast.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {cast.map((c) => (
            <div
              key={c.id}
              className="group relative rounded-lg border border-[var(--line)] bg-[var(--bg-2)] p-3 text-center"
            >
              {/* Avatar */}
              {c.image_url ? (
                <div className="relative mx-auto mb-2 h-16 w-16 overflow-hidden rounded-full">
                  <Image
                    src={stripStorageCacheBust(c.image_url) ?? c.image_url}
                    alt={c.name}
                    fill
                    unoptimized
                    className="object-cover"
                  />
                </div>
              ) : (
                <div className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--bg-3)] text-lg font-medium text-[var(--text-dim)]">
                  {c.name.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="truncate text-sm font-medium">{c.name}</div>
              {c.role && (
                <div className="mono truncate text-[11px] text-[var(--text-mute)]">
                  {c.role}
                </div>
              )}
              {/* Delete button */}
              <button
                className="text-brand-red-safe hover:text-brand-red-safe absolute end-1.5 top-1.5 flex size-9 items-center justify-center rounded-full bg-black/50 opacity-60 transition-opacity group-hover:opacity-100"
                onClick={() => handleDelete(c.id)}
                disabled={deletingId === c.id}
                aria-label={`${tCommon('delete')}: ${c.name}`}
              >
                {deletingId === c.id ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <Trash2 className="size-3" />
                )}
              </button>
            </div>
          ))}
        </div>
      ) : (
        !formOpen && (
          <div className="text-muted-foreground rounded-lg border border-dashed border-[var(--line-2)] py-8 text-center text-sm">
            {t('empty')}
          </div>
        )
      )}
    </div>
  )
}
