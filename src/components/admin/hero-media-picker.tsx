'use client'

import { useState, useRef } from 'react'
import { Upload, Loader2, Trash2, Link as LinkIcon, Film, Image as ImageIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { uploadArtwork, uploadShowVideoFile } from '@/app/admin/actions'
import { extractYouTubeId, getYouTubeThumbnailUrl } from '@/lib/youtube'

type Mode = 'image' | 'mp4' | 'youtube'

interface HeroMediaPickerProps {
  showId: string
  variant: 'desktop' | 'mobile'
  currentImageUrl: string | null
  currentVideoUrl: string | null
  currentVideoType: 'mp4' | 'youtube' | null
  onImageChange: (url: string | null) => void
  onVideoChange: (video: { url: string; type: 'mp4' | 'youtube' } | null) => void
}

export function HeroMediaPicker({
  showId,
  variant,
  currentImageUrl,
  currentVideoUrl,
  currentVideoType,
  onImageChange,
  onVideoChange,
}: HeroMediaPickerProps) {
  const initialMode: Mode = currentVideoType ?? 'image'
  const [mode, setMode] = useState<Mode>(initialMode)
  const [uploading, setUploading] = useState(false)
  const [youtubeInput, setYoutubeInput] = useState(
    currentVideoType === 'youtube' ? (currentVideoUrl ?? '') : ''
  )
  const fileInputRef = useRef<HTMLInputElement>(null)

  const label = variant === 'desktop' ? 'Desktop Hero' : 'Mobile Hero'
  const imageHint = variant === 'desktop' ? '16:9 landscape · 1920×1080' : '9:16 portrait · 1080×1920'
  // Aim users at ≤8 MB so mobile LCP stays fast. Max is 50MB for edge cases
  // (longer cinematics) but anything over ~8MB measurably hurts first paint on
  // 4G. Phrase the guidance as a target, not a hard rule.
  const videoHint = variant === 'desktop'
    ? 'Landscape · 1920×1080 · Target ≤8 MB for fast mobile playback · Max 50MB'
    : 'Portrait · 1080×1920 · Target ≤8 MB for fast mobile playback · Max 50MB'
  const imageSlot = variant === 'desktop' ? 'hero' : 'hero-mobile'

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) { toast.error('Image must be under 10MB'); return }
    setUploading(true)
    try {
      const formData = new FormData()
      formData.set('file', file)
      formData.set('showId', showId)
      formData.set('slot', imageSlot)
      const result = await uploadArtwork(formData)
      if (!result.success) { toast.error(result.error ?? 'Upload failed'); return }
      onImageChange(result.data!)
      onVideoChange(null)
      toast.success(`${label} image uploaded`)
    } catch {
      toast.error('Upload failed')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleMp4Upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 50 * 1024 * 1024) { toast.error('Video must be under 50MB'); return }
    setUploading(true)
    try {
      const formData = new FormData()
      formData.set('file', file)
      formData.set('showId', showId)
      formData.set('variant', variant)
      const result = await uploadShowVideoFile(formData)
      if (!result.success) { toast.error(result.error ?? 'Upload failed'); return }
      onVideoChange({ url: result.data!, type: 'mp4' })
      onImageChange(null)
      toast.success(`${label} video uploaded`)
    } catch {
      toast.error('Upload failed')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function handleYoutubeSave() {
    if (!youtubeInput.trim()) { toast.error('Paste a YouTube URL'); return }
    if (!extractYouTubeId(youtubeInput)) { toast.error('Invalid YouTube URL'); return }
    onVideoChange({ url: youtubeInput.trim(), type: 'youtube' })
    onImageChange(null)
    toast.success(`${label} YouTube URL set`)
  }

  // Clear nulls the form state only. We do NOT delete the storage file here — the
  // file is referenced by the live DB URL until the parent form is saved with the
  // nulled value. Clicking Cancel rolls back by keeping the DB URL pointing at the
  // still-existing file. Orphaned files from saves are cleaned by the scheduled
  // sweep (see TODOS.md).
  function handleRemove() {
    onImageChange(null)
    onVideoChange(null)
    setYoutubeInput('')
    toast.success(`${label} cleared`)
  }

  const hasContent = !!(currentImageUrl || currentVideoUrl)

  return (
    <div className="space-y-3 rounded-[20px] border border-white/8 bg-white/[0.02] p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">{label}</p>
        {hasContent && (
          <Button type="button" variant="ghost" size="sm" onClick={handleRemove} disabled={uploading}>
            <Trash2 className="mr-1.5 size-3.5" />
            Clear
          </Button>
        )}
      </div>

      {/* Current preview */}
      {hasContent && (
        <div className="relative overflow-hidden rounded-[14px] border border-white/10 bg-black">
          {currentVideoType === 'mp4' && currentVideoUrl ? (
            <video src={currentVideoUrl} muted autoPlay loop playsInline className="h-32 w-full object-cover" />
          ) : currentVideoType === 'youtube' && currentVideoUrl ? (() => {
            const ytId = extractYouTubeId(currentVideoUrl)
            return ytId ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={getYouTubeThumbnailUrl(ytId)} alt="" className="h-32 w-full object-cover" />
            ) : null
          })() : currentImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={currentImageUrl} alt="" className="h-32 w-full object-cover" />
          ) : null}
        </div>
      )}

      {/* Mode tabs */}
      <div className="flex gap-1.5">
        {(['image', 'mp4', 'youtube'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium transition-all ${
              mode === m
                ? 'bg-white text-black shadow-[0_8px_24px_rgba(255,255,255,0.14)]'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {m === 'image' && <><ImageIcon className="size-3.5" /> Image</>}
            {m === 'mp4' && <><Film className="size-3.5" /> MP4</>}
            {m === 'youtube' && <><LinkIcon className="size-3.5" /> YouTube</>}
          </button>
        ))}
      </div>

      {/* Mode content */}
      {uploading ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-[16px] border border-dashed border-white/12 bg-black/20 p-6">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Uploading…</p>
        </div>
      ) : mode === 'image' ? (
        <label className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-[16px] border border-dashed border-white/12 bg-black/20 p-6 transition-colors hover:border-white/20">
          <Upload className="size-5 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Click to upload image</p>
          <p className="text-xs text-muted-foreground">{imageHint}</p>
          <input ref={fileInputRef} type="file" accept="image/webp,image/png,image/jpeg" className="hidden" onChange={handleImageUpload} />
        </label>
      ) : mode === 'mp4' ? (
        <label className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-[16px] border border-dashed border-white/12 bg-black/20 p-6 transition-colors hover:border-white/20">
          <Upload className="size-5 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Click to upload MP4</p>
          <p className="text-xs text-muted-foreground">{videoHint}</p>
          <input ref={fileInputRef} type="file" accept="video/mp4" className="hidden" onChange={handleMp4Upload} />
        </label>
      ) : (
        <div className="flex gap-2">
          <input
            type="url"
            placeholder="https://www.youtube.com/watch?v=..."
            value={youtubeInput}
            onChange={(e) => setYoutubeInput(e.target.value)}
            className="flex-1 rounded-[12px] border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white placeholder:text-muted-foreground focus:border-white/20 focus:outline-none"
          />
          <Button type="button" size="sm" onClick={handleYoutubeSave} disabled={!youtubeInput.trim()}>
            Set
          </Button>
        </div>
      )}
    </div>
  )
}
