'use client'

import { useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import { Upload, Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { uploadSiteImage, removeSiteImage } from '@/app/[locale]/admin/actions'
import { stripStorageCacheBust } from '@/lib/supabase-media'

/**
 * Reusable image upload field for OG image + favicon.
 * Mirrors the pattern from hero-video-manager.tsx — optimistic local state,
 * server action returns the new URL, toast feedback, no form library needed.
 */
export function ImageUploadField({
  kind,
  currentUrl,
  accept,
  maxMb = 5,
  hint,
  previewClassName = 'size-32',
  previewBgClassName = 'bg-black/40',
}: {
  kind: 'og' | 'favicon' | 'favicon-dark' | 'auth'
  currentUrl: string | null
  accept: string
  maxMb?: number
  hint?: string
  previewClassName?: string
  /** Background of the preview tile. Defaults to a dark surface; pass a light
   *  surface when previewing an icon meant for light browser themes. */
  previewBgClassName?: string
}) {
  const resolvedCurrentUrl = stripStorageCacheBust(currentUrl) ?? currentUrl
  const [url, setUrl] = useState<string | null>(resolvedCurrentUrl)
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const t = useTranslations('admin.settings')

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > maxMb * 1024 * 1024) {
      toast.error(t('imageTooLarge', { max: maxMb }))
      return
    }
    setBusy(true)
    try {
      const fd = new FormData()
      fd.set('file', file)
      fd.set('kind', kind)
      const result = await uploadSiteImage(fd)
      if (!result.success) {
        toast.error(result.error ?? t('uploadFailed'))
        return
      }
      const publicUrl = result.data ?? null
      setUrl(publicUrl ? (stripStorageCacheBust(publicUrl) ?? publicUrl) : null)
      toast.success(t('uploaded'))
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function onRemove() {
    setBusy(true)
    const result = await removeSiteImage(kind)
    setBusy(false)
    if (!result.success) {
      toast.error(result.error ?? t('removeFailed'))
      return
    }
    setUrl(null)
    toast.success(t('removed'))
  }

  return (
    <div className="space-y-3">
      {url && (
        <div className="flex items-start gap-4">
          <div
            className={`relative overflow-hidden rounded-lg border border-[var(--line)] ${previewBgClassName} ${previewClassName}`}
          >
            {/* next/image with unoptimized for cache-busted dynamic URLs */}
            <Image
              src={url}
              alt={`${kind} preview`}
              fill
              unoptimized
              className="object-contain"
            />
          </div>
          <Button
            variant="destructive"
            size="sm"
            type="button"
            onClick={onRemove}
            disabled={busy}
          >
            <Trash2 className="me-2 size-4" />
            {t('remove')}
          </Button>
        </div>
      )}

      {busy ? (
        <div className="text-muted-foreground flex items-center gap-2 rounded-lg border border-dashed border-[var(--line-2)] bg-[var(--bg-2)] px-4 py-3 text-sm">
          <Loader2 className="size-4 animate-spin" />
          {t('working')}
        </div>
      ) : (
        <label className="text-muted-foreground hover:text-foreground flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-[var(--line-2)] bg-[var(--bg-2)] px-4 py-3 text-sm transition-colors hover:border-[var(--text-mute)]">
          <Upload className="size-4" />
          <span>{url ? t('replaceImage') : t('uploadImage')}</span>
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            className="hidden"
            onChange={onFile}
          />
        </label>
      )}

      {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
    </div>
  )
}
