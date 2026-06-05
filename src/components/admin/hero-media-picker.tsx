'use client'

import { useState, useRef } from 'react'
import { useTranslations } from 'next-intl'
import {
  Upload,
  Loader2,
  Trash2,
  Link as LinkIcon,
  Film,
  Image as ImageIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  createShowVideoUpload,
  saveShowVideoUpload,
  uploadArtwork,
} from '@/app/[locale]/admin/actions'
import { createClient as createBrowserSupabaseClient } from '@/lib/supabase/client'
import { extractYouTubeId, getYouTubeThumbnailUrl } from '@/lib/youtube'

type Mode = 'image' | 'mp4' | 'youtube'

interface HeroMediaPickerProps {
  showId: string
  variant: 'desktop' | 'mobile'
  currentImageUrl: string | null
  currentVideoUrl: string | null
  currentVideoType: 'mp4' | 'youtube' | null
  onImageChange: (url: string | null) => void
  onVideoChange: (
    video: { url: string; type: 'mp4' | 'youtube' } | null
  ) => void
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
  const t = useTranslations('admin.heroMedia')

  const label = variant === 'desktop' ? t('desktopHero') : t('mobileHero')
  const imageHint =
    variant === 'desktop' ? t('desktopImageHint') : t('mobileImageHint')
  const videoHint =
    variant === 'desktop' ? t('desktopVideoHint') : t('mobileVideoHint')
  const imageSlot = variant === 'desktop' ? 'hero' : 'hero-mobile'

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) {
      toast.error(t('imageTooLarge'))
      return
    }
    setUploading(true)
    try {
      const formData = new FormData()
      formData.set('file', file)
      formData.set('showId', showId)
      formData.set('slot', imageSlot)
      const result = await uploadArtwork(formData)
      if (!result.success) {
        toast.error(result.error ?? t('uploadFailed'))
        return
      }
      onImageChange(result.data!)
      onVideoChange(null)
      toast.success(t('uploadHeroSuccess', { label }))
    } catch {
      toast.error(t('uploadFailed'))
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleMp4Upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 50 * 1024 * 1024) {
      toast.error(t('videoTooLarge'))
      return
    }
    setUploading(true)
    try {
      const uploadTarget = await createShowVideoUpload({
        name: file.name,
        size: file.size,
        type: file.type,
        showId,
        variant,
      })
      if (!uploadTarget.success || !uploadTarget.data) {
        toast.error(uploadTarget.error ?? t('uploadFailed'))
        return
      }

      const supabase = createBrowserSupabaseClient()
      const { error: uploadError } = await supabase.storage
        .from('site-assets')
        .uploadToSignedUrl(
          uploadTarget.data.path,
          uploadTarget.data.token,
          file,
          {
            contentType: 'video/mp4',
            cacheControl: '3600',
          }
        )

      if (uploadError) {
        toast.error(uploadError.message)
        return
      }

      const result = await saveShowVideoUpload(uploadTarget.data.path)
      if (!result.success || !result.data) {
        toast.error(result.error ?? t('uploadFailed'))
        return
      }
      onVideoChange({ url: result.data, type: 'mp4' })
      onImageChange(null)
      toast.success(t('uploadVideoSuccess', { label }))
    } catch {
      toast.error(t('uploadFailed'))
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function handleYoutubeSave() {
    if (!youtubeInput.trim()) {
      toast.error(t('pasteYoutubePrompt'))
      return
    }
    if (!extractYouTubeId(youtubeInput)) {
      toast.error(t('invalidYoutube'))
      return
    }
    onVideoChange({ url: youtubeInput.trim(), type: 'youtube' })
    onImageChange(null)
    toast.success(t('youtubeSetSuccess', { label }))
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
    toast.success(t('removeSuccess', { label }))
  }

  const hasContent = !!(currentImageUrl || currentVideoUrl)
  const contentType: Mode | null = currentVideoType ?? (currentImageUrl ? 'image' : null)
  const isMobile = variant === 'mobile'
  const aspectBadge = isMobile ? '9:16' : '16:9'
  const sourceHint = mode === 'mp4' ? videoHint : imageHint

  const modes: { id: Mode; label: string; icon: typeof ImageIcon }[] = [
    { id: 'image', label: t('imageMode'), icon: ImageIcon },
    { id: 'mp4', label: 'MP4', icon: Film },
    { id: 'youtube', label: t('youtubeMode'), icon: LinkIcon },
  ]

  // Single hidden file input, retargeted by the active mode.
  const fileAccept = mode === 'mp4' ? 'video/mp4' : 'image/webp,image/png,image/jpeg'
  const fileHandler = mode === 'mp4' ? handleMp4Upload : handleImageUpload

  const mediaPreview =
    contentType === 'mp4' && currentVideoUrl ? (
      <video
        src={currentVideoUrl}
        muted
        autoPlay
        loop
        playsInline
        className="h-full w-full object-cover"
      />
    ) : contentType === 'youtube' && currentVideoUrl ? (
      (() => {
        const ytId = extractYouTubeId(currentVideoUrl)
        return ytId ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={getYouTubeThumbnailUrl(ytId)}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : null
      })()
    ) : currentImageUrl ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={currentImageUrl} alt="" className="h-full w-full object-cover" />
    ) : null

  return (
    <div className="space-y-2.5">
      {/* Header: label + aspect, source switcher */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-medium">{label}</span>
          <span className="text-muted-foreground rounded-full border border-white/8 bg-white/[0.03] px-2 py-0.5 font-mono text-[10px]">
            {aspectBadge}
          </span>
        </div>
        <div className="flex items-center gap-0.5 rounded-full border border-white/8 bg-white/[0.02] p-0.5">
          {modes.map(({ id, label: ml, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setMode(id)}
              className={cn(
                'flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
                mode === id
                  ? 'bg-white text-black'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="size-3.5" />
              <span className="hidden sm:inline">{ml}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Aspect-correct framed zone — preview + upload surface in one */}
      <div
        className={cn(
          'group relative overflow-hidden rounded-xl border bg-black/40',
          isMobile ? 'mx-auto aspect-[9/16] w-full max-w-[200px]' : 'aspect-video w-full',
          hasContent ? 'border-white/10' : 'border-dashed border-white/12'
        )}
      >
        {/* Hidden input reused for both empty-state click and Replace */}
        {mode !== 'youtube' && (
          <input
            ref={fileInputRef}
            type="file"
            accept={fileAccept}
            className="hidden"
            onChange={fileHandler}
          />
        )}

        {uploading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60">
            <Loader2 className="size-6 animate-spin text-white/70" />
            <p className="text-xs text-white/60">{t('uploadingVideo')}</p>
          </div>
        ) : hasContent ? (
          <>
            {mediaPreview}
            {/* Source badge */}
            {contentType && (
              <span className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white/80 backdrop-blur-sm">
                {contentType === 'mp4'
                  ? 'MP4'
                  : contentType === 'youtube'
                    ? t('youtubeMode')
                    : t('imageMode')}
              </span>
            )}
            {/* Hover actions */}
            <div className="absolute inset-0 flex items-center justify-center gap-2 bg-gradient-to-t from-black/70 to-black/30 opacity-0 transition-opacity group-hover:opacity-100">
              {mode !== 'youtube' && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-black transition-transform hover:scale-105"
                >
                  {t('replaceButton')}
                </button>
              )}
              <button
                type="button"
                onClick={handleRemove}
                className="flex items-center gap-1 rounded-full bg-white/15 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/25"
              >
                <Trash2 className="size-3.5" />
                {t('clearButton')}
              </button>
            </div>
          </>
        ) : mode === 'youtube' ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 px-4 text-center">
            <LinkIcon className="text-muted-foreground size-6" />
            <p className="text-muted-foreground text-xs">{t('youtubeUrlLabel')}</p>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 px-4 text-center transition-colors hover:bg-white/[0.03]"
          >
            <Upload className="text-muted-foreground size-6" />
            <p className="text-muted-foreground text-sm">
              {mode === 'mp4' ? t('clickToUploadMp4') : t('clickToUploadImage')}
            </p>
            <p className="text-muted-foreground text-[11px]">{sourceHint}</p>
          </button>
        )}
      </div>

      {/* YouTube URL field — only in YouTube mode */}
      {mode === 'youtube' && (
        <div className="flex gap-2">
          <input
            type="url"
            placeholder="https://www.youtube.com/watch?v=..."
            value={youtubeInput}
            onChange={(e) => setYoutubeInput(e.target.value)}
            className="placeholder:text-muted-foreground flex-1 rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2.5 text-sm text-white focus:border-white/20 focus:outline-none"
          />
          <Button
            type="button"
            size="sm"
            onClick={handleYoutubeSave}
            disabled={!youtubeInput.trim()}
          >
            {t('setButton')}
          </Button>
        </div>
      )}
    </div>
  )
}
