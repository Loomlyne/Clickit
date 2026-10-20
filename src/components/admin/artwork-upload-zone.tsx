'use client'

import { useState, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { Upload, MoreVertical, Trash2, Replace } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { finalizeArtworkUpload } from '@/app/[locale]/admin/actions'
import { uploadImageDirect, type UploadProgress } from '@/lib/browser-upload'
import { UploadStatus, notifyUploadError, notifyUploaded } from '@/components/admin/upload-status'
import { stripStorageCacheBust } from '@/lib/supabase-media'

interface ArtworkUploadZoneProps {
  showId: string
  slot: 'poster' | 'card' | 'hero' | 'hero-mobile' | 'logo'
  currentUrl: string | null
  onUploadComplete: (publicUrl: string) => void
  onDelete?: () => void
  label: string
  aspectHint: string
}

const MAX_SIZE_BYTES: Record<string, number> = {
  poster: 10 * 1024 * 1024,
  card: 10 * 1024 * 1024,
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
  const [progress, setProgress] = useState<UploadProgress | null>(null)
  const resolvedCurrentUrl = stripStorageCacheBust(currentUrl) ?? currentUrl
  const [previewUrl, setPreviewUrl] = useState<string | null>(resolvedCurrentUrl)
  const inputRef = useRef<HTMLInputElement>(null)
  const t = useTranslations('admin.artwork')
  const tSettings = useTranslations('admin.settings')

  // Browser -> R2 directly (requestMediaUpload, PUT, finalize). commit:false keeps
  // today's behaviour: the new URL is held by the drawer and written on Save.
  async function uploadFile(file: File) {
    const maxMB = MAX_SIZE_BYTES[slot] / (1024 * 1024)
    setProgress({ fileName: file.name, fileSize: file.size, percent: 0, phase: 'uploading', variantCount: 0 })
    try {
      const result = await uploadImageDirect({
        file,
        kind: 'artwork',
        slot,
        showId,
        finalize: ({ key, variantKeys }) =>
          finalizeArtworkUpload({ showId, slot, key, variantKeys, commit: false }),
        onProgress: setProgress,
      })
      if (!result.ok) {
        notifyUploadError(result.error, {
          retry: () => void uploadFile(file),
          tooLargeMessage: t('fileTooLarge', { max: maxMB, slot }),
        })
        return
      }
      setPreviewUrl(stripStorageCacheBust(result.url) ?? result.url)
      onUploadComplete(result.url)
      notifyUploaded({ message: tSettings('uploaded'), safariFallback: result.safariFallback })
    } catch {
      toast.error(t('uploadFailedToast'))
    } finally {
      setProgress(null)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    void uploadFile(file)
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
    toast.success(t('clearedToast', { label }))
  }

  // Uploading state (signed: progress inside the zone, messages as toasts)
  if (progress) {
    return (
      <div className="space-y-2">
        <p className="text-sm font-medium">{label}</p>
        <UploadStatus progress={progress} />
        <p className="text-muted-foreground text-xs">{aspectHint}</p>
      </div>
    )
  }

  // Uploaded state (has preview)
  if (previewUrl) {
    return (
      <div className="space-y-2">
        <p className="text-sm font-medium">{label}</p>
        <div className="relative overflow-hidden rounded-lg border border-white/8 bg-white/[0.02]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt={label}
            className="h-32 w-full object-cover"
          />
          <div className="absolute inset-x-0 bottom-0 flex justify-end bg-gradient-to-t from-black/60 to-transparent p-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="size-8"
                >
                  <MoreVertical className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => inputRef.current?.click()}>
                  <Replace className="size-4" />
                  {t('replaceButton')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleDelete}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="size-4" />
                  {t('deleteButton')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <p className="text-muted-foreground text-xs">{aspectHint}</p>
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
      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-white/12 bg-white/[0.02] p-6 transition-colors hover:border-white/20">
        <Upload className="text-muted-foreground size-6" />
        <p className="text-muted-foreground text-sm">{t('clickToUpload')}</p>
        <p className="text-muted-foreground text-xs">{aspectHint}</p>
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
