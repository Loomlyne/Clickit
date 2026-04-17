'use client'

import { useState, useRef } from 'react'
import { Upload, Loader2, Trash2, Link as LinkIcon, Film } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { uploadShowVideoFile, deleteShowVideoFile } from '@/app/admin/actions'
import { extractYouTubeId, getYouTubeThumbnailUrl } from '@/lib/youtube'

export type VideoConfig = { url: string; type: 'mp4' | 'youtube' } | null

interface ShowVideoManagerProps {
  showId: string
  variant: 'desktop' | 'mobile'
  currentVideo: VideoConfig
  onChange: (video: VideoConfig) => void
}

export function ShowVideoManager({ showId, variant, currentVideo, onChange }: ShowVideoManagerProps) {
  const [mode, setMode] = useState<'mp4' | 'youtube'>(currentVideo?.type ?? 'mp4')
  const [uploading, setUploading] = useState(false)
  const [youtubeInput, setYoutubeInput] = useState(
    currentVideo?.type === 'youtube' ? currentVideo.url : ''
  )
  const inputRef = useRef<HTMLInputElement>(null)

  const label = variant === 'desktop' ? 'Desktop Video (16:9)' : 'Mobile Video (9:16)'
  const aspectHint = variant === 'desktop'
    ? 'Landscape · 1920×1080 recommended · Max 50MB'
    : 'Portrait · 1080×1920 recommended · Max 50MB'

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
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
      onChange({ url: result.data!, type: 'mp4' })
      toast.success(`${label} uploaded`)
    } catch {
      toast.error('Upload failed')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  function handleYoutubeSave() {
    if (!youtubeInput.trim()) { toast.error('Paste a YouTube URL'); return }
    if (!extractYouTubeId(youtubeInput)) { toast.error('Invalid YouTube URL'); return }
    onChange({ url: youtubeInput.trim(), type: 'youtube' })
    toast.success(`${label} URL set — save the show to persist`)
  }

  async function handleRemove() {
    setUploading(true)
    try {
      if (currentVideo?.type === 'mp4') {
        await deleteShowVideoFile(showId, variant)
      }
      onChange(null)
      setYoutubeInput('')
      toast.success(`${label} removed`)
    } catch {
      toast.error('Failed to remove')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>

      {currentVideo && (
        <div className="mb-4 space-y-2">
          <div className="relative overflow-hidden rounded-[16px] border border-white/10 bg-black">
            {currentVideo.type === 'mp4' ? (
              <video src={currentVideo.url} muted autoPlay loop playsInline className="h-32 w-full object-cover" />
            ) : (() => {
              const ytId = extractYouTubeId(currentVideo.url)
              return ytId ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={getYouTubeThumbnailUrl(ytId)} alt="YouTube thumbnail" className="h-32 w-full object-cover" />
              ) : null
            })()}
          </div>
          <Button variant="destructive" size="sm" onClick={handleRemove} disabled={uploading}>
            <Trash2 className="mr-2 size-4" />
            Remove
          </Button>
        </div>
      )}

      <div className="flex gap-2">
        {(['mp4', 'youtube'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all ${
              mode === m
                ? 'bg-white text-black shadow-[0_10px_30px_rgba(255,255,255,0.18)]'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {m === 'mp4' ? <Film className="size-4" /> : <LinkIcon className="size-4" />}
            {m === 'mp4' ? 'Upload MP4' : 'YouTube URL'}
          </button>
        ))}
      </div>

      {mode === 'mp4' && (
        uploading ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-[24px] border border-dashed border-white/12 bg-black/20 p-8">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Uploading video...</p>
          </div>
        ) : (
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[24px] border border-dashed border-white/12 bg-black/20 p-8 transition-colors hover:border-white/20">
            <Upload className="size-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Click to upload MP4</p>
            <p className="text-xs text-muted-foreground">{aspectHint}</p>
            <input ref={inputRef} type="file" accept="video/mp4" className="hidden" onChange={handleFileUpload} />
          </label>
        )
      )}

      {mode === 'youtube' && (
        <div className="flex gap-3">
          <input
            type="url"
            placeholder="https://www.youtube.com/watch?v=..."
            value={youtubeInput}
            onChange={(e) => setYoutubeInput(e.target.value)}
            className="flex-1 rounded-[16px] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white placeholder:text-muted-foreground focus:border-white/20 focus:outline-none"
          />
          <Button type="button" onClick={handleYoutubeSave} disabled={!youtubeInput.trim()}>
            Set URL
          </Button>
        </div>
      )}
    </div>
  )
}
