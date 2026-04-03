'use client'

import { useState, useRef } from 'react'
import { Upload, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

interface ArtworkUploadZoneProps {
  showId: string
  slot: 'poster' | 'hero' | 'logo'
  currentUrl: string | null
  onUploadComplete: (publicUrl: string) => void
  label: string
  aspectHint: string
}

const MAX_SIZE_BYTES: Record<string, number> = {
  poster: 5 * 1024 * 1024,
  hero: 5 * 1024 * 1024,
  logo: 2 * 1024 * 1024,
}

export function ArtworkUploadZone({
  showId,
  slot,
  currentUrl,
  onUploadComplete,
  label,
  aspectHint,
}: ArtworkUploadZoneProps) {
  const [uploading, setUploading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentUrl)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    // Client-side file size validation
    const maxSize = MAX_SIZE_BYTES[slot]
    if (file.size > maxSize) {
      const maxMB = maxSize / (1024 * 1024)
      toast.error(`Upload failed. File may be too large (max ${maxMB}MB).`)
      return
    }

    setUploading(true)

    try {
      const supabase = createClient()
      const ext = slot === 'logo' ? 'png' : 'webp'
      const path = `shows/${showId}/${slot}.${ext}`

      const { error } = await supabase.storage
        .from('show-artwork')
        .upload(path, file, {
          upsert: true,
          contentType: file.type,
          cacheControl: '3600',
        })

      if (error) {
        toast.error('Upload failed. File may be too large (max 5MB).')
        setUploading(false)
        return
      }

      const { data: urlData } = supabase.storage
        .from('show-artwork')
        .getPublicUrl(path)

      const publicUrl = urlData.publicUrl
      setPreviewUrl(publicUrl)
      onUploadComplete(publicUrl)
    } catch {
      toast.error('Upload failed. File may be too large (max 5MB).')
    } finally {
      setUploading(false)
      // Reset input so same file can be re-selected
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  // Uploading state
  if (uploading) {
    return (
      <div className="space-y-2">
        <p className="text-sm font-medium">{label}</p>
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border p-6">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Uploading...</p>
        </div>
      </div>
    )
  }

  // Uploaded state (has preview)
  if (previewUrl) {
    return (
      <div className="space-y-2">
        <p className="text-sm font-medium">{label}</p>
        <div className="relative overflow-hidden rounded-lg border border-border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt={label}
            className="h-32 w-full object-cover"
          />
          <div className="absolute inset-x-0 bottom-0 flex justify-end bg-gradient-to-t from-black/60 to-transparent p-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => inputRef.current?.click()}
            >
              Replace
            </Button>
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
      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border p-6 transition-colors hover:border-muted-foreground">
        <Upload className="size-6 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Click to upload</p>
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
