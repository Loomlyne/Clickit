'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import { Upload, Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { uploadSiteImage, removeSiteImage } from '@/app/[locale]/admin/actions'

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
}: {
  kind: 'og' | 'favicon'
  currentUrl: string | null
  accept: string
  maxMb?: number
  hint?: string
  previewClassName?: string
}) {
  const [url, setUrl] = useState<string | null>(currentUrl)
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > maxMb * 1024 * 1024) {
      toast.error(`Image must be under ${maxMb}MB`)
      return
    }
    setBusy(true)
    try {
      const fd = new FormData()
      fd.set('file', file)
      fd.set('kind', kind)
      const result = await uploadSiteImage(fd)
      if (!result.success) {
        toast.error(result.error ?? 'Upload failed')
        return
      }
      setUrl(result.data ?? null)
      toast.success('Uploaded')
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
      toast.error(result.error ?? 'Failed to remove')
      return
    }
    setUrl(null)
    toast.success('Removed')
  }

  return (
    <div className="space-y-3">
      {url && (
        <div className="flex items-start gap-4">
          <div
            className={`relative overflow-hidden rounded-[12px] border border-white/10 bg-black/40 ${previewClassName}`}
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
            <Trash2 className="mr-2 size-4" />
            Remove
          </Button>
        </div>
      )}

      {busy ? (
        <div className="flex items-center gap-2 rounded-[12px] border border-dashed border-white/12 bg-black/20 px-4 py-3 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Working…
        </div>
      ) : (
        <label className="flex cursor-pointer items-center gap-2 rounded-[12px] border border-dashed border-white/12 bg-black/20 px-4 py-3 text-sm text-muted-foreground transition-colors hover:border-white/20 hover:text-foreground">
          <Upload className="size-4" />
          <span>{url ? 'Replace image' : 'Upload image'}</span>
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            className="hidden"
            onChange={onFile}
          />
        </label>
      )}

      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}
