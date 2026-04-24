'use client'

import { useState, useRef } from 'react'
import { useLocale } from 'next-intl'
import { Upload, Loader2, MoreVertical, Trash2, Replace } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { uploadArtwork } from '@/app/[locale]/admin/actions'

interface ArtworkUploadZoneProps {
  showId: string
  slot: 'poster' | 'hero' | 'hero-mobile' | 'logo'
  currentUrl: string | null
  onUploadComplete: (publicUrl: string) => void
  onDelete?: () => void
  label: string
  aspectHint: string
}

const MAX_SIZE_BYTES: Record<string, number> = {
  poster: 10 * 1024 * 1024,
  hero: 10 * 1024 * 1024,
  'hero-mobile': 10 * 1024 * 1024,
  logo: 2 * 1024 * 1024,
}

export function ArtworkUploadZone({
  showId,
  slot,
  currentUrl,
  onUploadComplete,
  onDelete,
  label,
  aspectHint,
}: ArtworkUploadZoneProps) {
  const [uploading, setUploading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentUrl)
  const inputRef = useRef<HTMLInputElement>(null)
  const locale = useLocale()
  const isArabic = locale === 'ar'

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const maxSize = MAX_SIZE_BYTES[slot]
    if (file.size > maxSize) {
      const maxMB = maxSize / (1024 * 1024)
      toast.error(isArabic ? `الملف كبير جداً — الحد الأقصى ${maxMB} ميغابايت` : `File too large — max ${maxMB}MB for ${slot}.`)
      return
    }

    setUploading(true)

    try {
      const formData = new FormData()
      formData.set('file', file)
      formData.set('showId', showId)
      formData.set('slot', slot)

      const result = await uploadArtwork(formData)

      if (!result.success) {
        toast.error(isArabic ? `فشل الرفع: ${result.error}` : `Upload failed: ${result.error}`)
        return
      }

      setPreviewUrl(result.data!)
      onUploadComplete(result.data!)
    } catch {
      toast.error(isArabic ? 'فشل الرفع. يُرجى المحاولة مرة أخرى.' : 'Upload failed. Please try again.')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  // Delete nulls the form state only. We do NOT delete the storage file here —
  // the file is referenced by the live DB URL until the parent form is saved with
  // the nulled value. Clicking Cancel rolls back by keeping the DB URL pointing
  // at the still-existing file. Orphaned files from saves are cleaned by the
  // scheduled sweep (see /api/cron/cleanup-media). This also eliminates the
  // "delete lies on failure" pattern the previous implementation had, where a
  // failing deleteArtwork() would leave local state cleared but toast success.
  function handleDelete() {
    setPreviewUrl(null)
    onDelete?.()
    toast.success(isArabic ? `تم مسح ${label}` : `${label} cleared`)
  }

  // Uploading state
  if (uploading) {
    return (
      <div className="space-y-2">
        <p className="text-sm font-medium">{label}</p>
        <div className="flex flex-col items-center justify-center gap-2 rounded-[6px] border border-dashed border-white/12 bg-[var(--bg-2)] p-6">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{isArabic ? 'جارٍ الرفع…' : 'Uploading...'}</p>
        </div>
      </div>
    )
  }

  // Uploaded state (has preview)
  if (previewUrl) {
    return (
      <div className="space-y-2">
        <p className="text-sm font-medium">{label}</p>
        <div className="relative overflow-hidden rounded-[6px] border border-[var(--line)] bg-[var(--bg-2)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt={label}
            className="h-32 w-full object-cover"
          />
          <div className="absolute inset-x-0 bottom-0 flex justify-end bg-gradient-to-t from-black/60 to-transparent p-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="secondary" size="icon" className="size-8">
                  <MoreVertical className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => inputRef.current?.click()}>
                  <Replace className="size-4" />
                  {isArabic ? 'استبدال' : 'Replace'}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleDelete}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="size-4" />
                  {isArabic ? 'حذف' : 'Delete'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{aspectHint}</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/webp,image/png,image/jpeg"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>
    )
  }

  // Empty state
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[6px] border border-dashed border-white/12 bg-[var(--bg-2)] p-6 transition-colors hover:border-white/20">
        <Upload className="size-6 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{isArabic ? 'انقر للرفع' : 'Click to upload'}</p>
        <p className="text-xs text-muted-foreground">{aspectHint}</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/webp,image/png,image/jpeg"
          className="hidden"
          onChange={handleFileChange}
        />
      </label>
    </div>
  )
}
