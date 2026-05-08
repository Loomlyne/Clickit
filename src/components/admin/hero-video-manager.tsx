'use client'

import { useState, useRef } from 'react'
import { useLocale } from 'next-intl'
import { Upload, Loader2, Trash2, Link as LinkIcon, Film } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  createHeroVideoUpload,
  saveHeroVideoUpload,
  setHeroVideoUrl,
  removeHeroVideo,
} from '@/app/[locale]/admin/actions'
import { createClient as createBrowserSupabaseClient } from '@/lib/supabase/client'
import { extractYouTubeId, getYouTubeThumbnailUrl } from '@/lib/youtube'

type VideoConfig = { url: string; type: 'mp4' | 'youtube' } | null

export function HeroVideoManager({
  currentVideo,
}: {
  currentVideo: VideoConfig
}) {
  const [video, setVideo] = useState<VideoConfig>(currentVideo)
  const [mode, setMode] = useState<'mp4' | 'youtube'>(
    currentVideo?.type ?? 'mp4'
  )
  const [uploading, setUploading] = useState(false)
  const [youtubeInput, setYoutubeInput] = useState(
    currentVideo?.type === 'youtube' ? currentVideo.url : ''
  )
  const inputRef = useRef<HTMLInputElement>(null)
  const locale = useLocale()
  const isArabic = locale === 'ar'

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
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
      const uploadTarget = await createHeroVideoUpload({
        name: file.name,
        size: file.size,
        type: file.type,
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
            upsert: true,
          }
        )

      if (uploadError) {
        toast.error(uploadError.message)
        return
      }

      const result = await saveHeroVideoUpload(uploadTarget.data.path)
      if (!result.success || !result.data) {
        toast.error(result.error ?? (isArabic ? 'فشل الرفع' : 'Upload failed'))
        return
      }

      setVideo({ url: result.data, type: 'mp4' })
      toast.success(isArabic ? 'تم رفع فيديو الهيرو' : 'Hero video uploaded')
    } catch {
      toast.error(isArabic ? 'فشل الرفع' : 'Upload failed')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function handleYoutubeSave() {
    if (!youtubeInput.trim()) {
      toast.error(isArabic ? 'الصق رابط يوتيوب' : 'Paste a YouTube URL')
      return
    }

    const id = extractYouTubeId(youtubeInput)
    if (!id) {
      toast.error(isArabic ? 'رابط يوتيوب غير صالح' : 'Invalid YouTube URL')
      return
    }

    setUploading(true)
    try {
      const result = await setHeroVideoUrl(youtubeInput.trim())
      if (!result.success) {
        toast.error(
          result.error ?? (isArabic ? 'تعذّر الحفظ' : 'Failed to save')
        )
        return
      }
      setVideo({ url: youtubeInput.trim(), type: 'youtube' })
      toast.success(
        isArabic ? 'تم حفظ رابط فيديو الهيرو' : 'Hero video URL saved'
      )
    } catch {
      toast.error(isArabic ? 'تعذّر الحفظ' : 'Failed to save')
    } finally {
      setUploading(false)
    }
  }

  async function handleRemove() {
    setUploading(true)
    try {
      const result = await removeHeroVideo()
      if (!result.success) {
        toast.error(
          result.error ?? (isArabic ? 'تعذّر الحذف' : 'Failed to remove')
        )
        return
      }
      setVideo(null)
      setYoutubeInput('')
      toast.success(isArabic ? 'تم حذف فيديو الهيرو' : 'Hero video removed')
    } catch {
      toast.error(isArabic ? 'تعذّر الحذف' : 'Failed to remove')
    } finally {
      setUploading(false)
    }
  }

  // Current video preview
  const preview = video ? (
    <div className="mb-6 space-y-3">
      <p className="text-xs font-medium tracking-[0.2em] text-white/40 uppercase">
        {isArabic ? 'الحالي:' : 'Current:'}{' '}
        {video.type === 'mp4'
          ? isArabic
            ? 'ملف MP4'
            : 'MP4 File'
          : isArabic
            ? 'يوتيوب'
            : 'YouTube'}
      </p>
      <div className="relative overflow-hidden rounded-lg border border-white/8 bg-black">
        {video.type === 'mp4' ? (
          <video
            src={video.url}
            muted
            autoPlay
            loop
            playsInline
            className="h-48 w-full object-cover"
          />
        ) : (
          (() => {
            const ytId = extractYouTubeId(video.url)
            return ytId ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={getYouTubeThumbnailUrl(ytId)}
                alt="YouTube thumbnail"
                className="h-48 w-full object-cover"
              />
            ) : null
          })()
        )}
      </div>
      <Button
        variant="destructive"
        size="sm"
        onClick={handleRemove}
        disabled={uploading}
      >
        <Trash2 className="me-2 size-4" />
        {isArabic ? 'حذف الفيديو' : 'Remove Video'}
      </Button>
    </div>
  ) : null

  return (
    <div>
      {preview}

      {/* Mode toggle */}
      <div className="mb-4 flex gap-2">
        <button
          type="button"
          onClick={() => setMode('mp4')}
          className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all ${
            mode === 'mp4'
              ? 'bg-white text-black shadow-[0_10px_30px_rgba(255,255,255,0.18)]'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Film className="size-4" />
          {isArabic ? 'رفع MP4' : 'Upload MP4'}
        </button>
        <button
          type="button"
          onClick={() => setMode('youtube')}
          className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all ${
            mode === 'youtube'
              ? 'bg-white text-black shadow-[0_10px_30px_rgba(255,255,255,0.18)]'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <LinkIcon className="size-4" />
          {isArabic ? 'رابط يوتيوب' : 'YouTube URL'}
        </button>
      </div>

      {/* MP4 upload */}
      {mode === 'mp4' && (
        <div>
          {uploading ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-white/12 bg-white/[0.02] p-8">
              <Loader2 className="text-muted-foreground size-6 animate-spin" />
              <p className="text-muted-foreground text-sm">
                {isArabic ? 'جارٍ رفع الفيديو…' : 'Uploading video...'}
              </p>
            </div>
          ) : (
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-white/12 bg-white/[0.02] p-8 transition-colors hover:border-white/20">
              <Upload className="text-muted-foreground size-6" />
              <p className="text-muted-foreground text-sm">
                {isArabic ? 'انقر لرفع MP4' : 'Click to upload MP4'}
              </p>
              <p className="text-muted-foreground text-xs">
                {isArabic
                  ? 'الحد 50 م.ب. · يعمل بدون صوت كخلفية هيرو'
                  : 'Max 50MB · Plays muted as hero background'}
              </p>
              <input
                ref={inputRef}
                type="file"
                accept="video/mp4"
                className="hidden"
                onChange={handleFileUpload}
              />
            </label>
          )}
        </div>
      )}

      {/* YouTube URL input */}
      {mode === 'youtube' && (
        <div className="flex gap-3">
          <input
            type="url"
            placeholder="https://www.youtube.com/watch?v=..."
            value={youtubeInput}
            onChange={(e) => setYoutubeInput(e.target.value)}
            className="placeholder:text-muted-foreground flex-1 rounded-lg border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-white focus:border-white/20 focus:outline-none"
          />
          <Button
            onClick={handleYoutubeSave}
            disabled={uploading || !youtubeInput.trim()}
          >
            {uploading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : isArabic ? (
              'حفظ'
            ) : (
              'Save'
            )}
          </Button>
        </div>
      )}
    </div>
  )
}
