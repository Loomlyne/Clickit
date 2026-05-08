'use client'

import { useState, useRef } from 'react'
import { useLocale } from 'next-intl'
import {
  Upload,
  Loader2,
  Trash2,
  Link as LinkIcon,
  Film,
  Image as ImageIcon,
} from 'lucide-react'
import { toast } from 'sonner'
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
  const locale = useLocale()
  const isArabic = locale === 'ar'

  const label =
    variant === 'desktop'
      ? isArabic
        ? 'هيرو سطح المكتب'
        : 'Desktop Hero'
      : isArabic
        ? 'هيرو الجوّال'
        : 'Mobile Hero'
  const imageHint =
    variant === 'desktop'
      ? isArabic
        ? '16:9 أفقي · 1920×1080'
        : '16:9 landscape · 1920×1080'
      : isArabic
        ? '9:16 عمودي · 1080×1920'
        : '9:16 portrait · 1080×1920'
  const videoHint =
    variant === 'desktop'
      ? isArabic
        ? 'أفقي · 1920×1080 · الحجم المُستهدف ≤8 م.ب. لتشغيل سريع على الجوّال · الحد 50 م.ب.'
        : 'Landscape · 1920×1080 · Target ≤8 MB for fast mobile playback · Max 50MB'
      : isArabic
        ? 'عمودي · 1080×1920 · الحجم المُستهدف ≤8 م.ب. لتشغيل سريع على الجوّال · الحد 50 م.ب.'
        : 'Portrait · 1080×1920 · Target ≤8 MB for fast mobile playback · Max 50MB'
  const imageSlot = variant === 'desktop' ? 'hero' : 'hero-mobile'

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) {
      toast.error(
        isArabic
          ? 'يجب أن تكون الصورة أقل من 10 م.ب.'
          : 'Image must be under 10MB'
      )
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
        toast.error(result.error ?? (isArabic ? 'فشل الرفع' : 'Upload failed'))
        return
      }
      onImageChange(result.data!)
      onVideoChange(null)
      toast.success(
        isArabic ? `تم رفع صورة ${label}` : `${label} image uploaded`
      )
    } catch {
      toast.error(isArabic ? 'فشل الرفع' : 'Upload failed')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleMp4Upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 50 * 1024 * 1024) {
      toast.error(
        isArabic
          ? 'يجب أن يكون الفيديو أقل من 50 م.ب.'
          : 'Video must be under 50MB'
      )
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
        toast.error(
          uploadTarget.error ?? (isArabic ? 'فشل الرفع' : 'Upload failed')
        )
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
        toast.error(result.error ?? (isArabic ? 'فشل الرفع' : 'Upload failed'))
        return
      }
      onVideoChange({ url: result.data, type: 'mp4' })
      onImageChange(null)
      toast.success(
        isArabic ? `تم رفع فيديو ${label}` : `${label} video uploaded`
      )
    } catch {
      toast.error(isArabic ? 'فشل الرفع' : 'Upload failed')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function handleYoutubeSave() {
    if (!youtubeInput.trim()) {
      toast.error(isArabic ? 'الصق رابط يوتيوب' : 'Paste a YouTube URL')
      return
    }
    if (!extractYouTubeId(youtubeInput)) {
      toast.error(isArabic ? 'رابط يوتيوب غير صالح' : 'Invalid YouTube URL')
      return
    }
    onVideoChange({ url: youtubeInput.trim(), type: 'youtube' })
    onImageChange(null)
    toast.success(
      isArabic ? `تم تعيين رابط يوتيوب لـ ${label}` : `${label} YouTube URL set`
    )
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
    toast.success(isArabic ? `تم مسح ${label}` : `${label} cleared`)
  }

  const hasContent = !!(currentImageUrl || currentVideoUrl)

  return (
    <div className="space-y-3 rounded-lg border border-white/8 bg-white/[0.02] p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">{label}</p>
        {hasContent && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleRemove}
            disabled={uploading}
          >
            <Trash2 className="me-1.5 size-3.5" />
            {isArabic ? 'مسح' : 'Clear'}
          </Button>
        )}
      </div>

      {/* Current preview */}
      {hasContent && (
        <div className="relative overflow-hidden rounded-lg border border-white/8 bg-black">
          {currentVideoType === 'mp4' && currentVideoUrl ? (
            <video
              src={currentVideoUrl}
              muted
              autoPlay
              loop
              playsInline
              className="h-32 w-full object-cover"
            />
          ) : currentVideoType === 'youtube' && currentVideoUrl ? (
            (() => {
              const ytId = extractYouTubeId(currentVideoUrl)
              return ytId ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={getYouTubeThumbnailUrl(ytId)}
                  alt=""
                  className="h-32 w-full object-cover"
                />
              ) : null
            })()
          ) : currentImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={currentImageUrl}
              alt=""
              className="h-32 w-full object-cover"
            />
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
            {m === 'image' && (
              <>
                <ImageIcon className="size-3.5" /> {isArabic ? 'صورة' : 'Image'}
              </>
            )}
            {m === 'mp4' && (
              <>
                <Film className="size-3.5" /> MP4
              </>
            )}
            {m === 'youtube' && (
              <>
                <LinkIcon className="size-3.5" />{' '}
                {isArabic ? 'يوتيوب' : 'YouTube'}
              </>
            )}
          </button>
        ))}
      </div>

      {/* Mode content */}
      {uploading ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-white/12 bg-white/[0.02] p-6">
          <Loader2 className="text-muted-foreground size-5 animate-spin" />
          <p className="text-muted-foreground text-sm">
            {isArabic ? 'جارٍ الرفع…' : 'Uploading…'}
          </p>
        </div>
      ) : mode === 'image' ? (
        <label className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-white/12 bg-white/[0.02] p-6 transition-colors hover:border-white/20">
          <Upload className="text-muted-foreground size-5" />
          <p className="text-muted-foreground text-sm">
            {isArabic ? 'انقر لرفع صورة' : 'Click to upload image'}
          </p>
          <p className="text-muted-foreground text-xs">{imageHint}</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/webp,image/png,image/jpeg"
            className="hidden"
            onChange={handleImageUpload}
          />
        </label>
      ) : mode === 'mp4' ? (
        <label className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-white/12 bg-white/[0.02] p-6 transition-colors hover:border-white/20">
          <Upload className="text-muted-foreground size-5" />
          <p className="text-muted-foreground text-sm">
            {isArabic ? 'انقر لرفع MP4' : 'Click to upload MP4'}
          </p>
          <p className="text-muted-foreground text-xs">{videoHint}</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4"
            className="hidden"
            onChange={handleMp4Upload}
          />
        </label>
      ) : (
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
            {isArabic ? 'تعيين' : 'Set'}
          </Button>
        </div>
      )}
    </div>
  )
}
