'use client'

import { useState, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { Upload, Loader2, Trash2, Link as LinkIcon, Film, Volume2, VolumeX, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  createHeroVideoUpload,
  saveHeroVideoUpload,
  setHeroVideoUrl,
  removeHeroVideo,
  setHeroVideoMuted,
} from '@/app/[locale]/admin/actions'
import { createClient as createBrowserSupabaseClient } from '@/lib/supabase/client'
import { extractYouTubeId, getYouTubeThumbnailUrl } from '@/lib/youtube'

type VideoConfig = { url: string; type: 'mp4' | 'youtube' } | null

export function HeroVideoManager({
  currentVideo,
  heroVideoMuted,
}: {
  currentVideo: VideoConfig
  heroVideoMuted: boolean
}) {
  const [video, setVideo] = useState<VideoConfig>(currentVideo)
  const [mode, setMode] = useState<'mp4' | 'youtube'>(
    currentVideo?.type ?? 'mp4'
  )
  const [uploading, setUploading] = useState(false)
  const [youtubeInput, setYoutubeInput] = useState(
    currentVideo?.type === 'youtube' ? currentVideo.url : ''
  )
  const [muted, setMuted] = useState(heroVideoMuted)
  const [savingAudio, setSavingAudio] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const t = useTranslations('admin.heroMedia')

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 50 * 1024 * 1024) {
      toast.error(t('videoTooLarge'))
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
            upsert: true,
          }
        )

      if (uploadError) {
        toast.error(uploadError.message)
        return
      }

      const result = await saveHeroVideoUpload(uploadTarget.data.path)
      if (!result.success || !result.data) {
        toast.error(result.error ?? t('uploadFailed'))
        return
      }

      setVideo({ url: result.data, type: 'mp4' })
      toast.success(t('uploadVideoSuccess', { label: t('desktopHero') }))
    } catch {
      toast.error(t('uploadFailed'))
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function handleYoutubeSave() {
    if (!youtubeInput.trim()) {
      toast.error(t('pasteYoutubePrompt'))
      return
    }

    const id = extractYouTubeId(youtubeInput)
    if (!id) {
      toast.error(t('invalidYoutube'))
      return
    }

    setUploading(true)
    try {
      const result = await setHeroVideoUrl(youtubeInput.trim())
      if (!result.success) {
        toast.error(result.error ?? t('saveFailed'))
        return
      }
      setVideo({ url: youtubeInput.trim(), type: 'youtube' })
      toast.success(t('savedSuccess'))
    } catch {
      toast.error(t('saveFailed'))
    } finally {
      setUploading(false)
    }
  }

  async function handleRemove() {
    setUploading(true)
    try {
      const result = await removeHeroVideo()
      if (!result.success) {
        toast.error(result.error ?? t('removeFailed'))
        return
      }
      setVideo(null)
      setYoutubeInput('')
      toast.success(t('removeSuccess', { label: t('desktopHero') }))
    } catch {
      toast.error(t('removeFailed'))
    } finally {
      setUploading(false)
    }
  }

  async function handleToggleAudio() {
    const next = !muted
    setSavingAudio(true)
    try {
      const result = await setHeroVideoMuted(next)
      if (!result.success) {
        toast.error(result.error ?? t('saveFailed'))
        return
      }
      setMuted(next)
      toast.success(next ? t('audioMuted') : t('audioOn'))
    } catch {
      toast.error(t('saveFailed'))
    } finally {
      setSavingAudio(false)
    }
  }

  // Current video preview
  const preview = video ? (
    <div className="mb-6 space-y-3">
      <p className="text-xs font-medium tracking-[0.2em] text-white/40 uppercase">
        {t('currentLabel')}{' '}
        {video.type === 'mp4' ? t('mp4File') : t('youtubeMode')}
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
                alt={t('youtubeThumbnailAlt')}
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
        {t('removeButton')}
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
          {t('uploadMp4')}
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
          {t('youtubeUrlLabel')}
        </button>
      </div>

      {/* MP4 upload */}
      {mode === 'mp4' && (
        <div>
          {uploading ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-white/12 bg-white/[0.02] p-8">
              <Loader2 className="text-muted-foreground size-6 animate-spin" />
              <p className="text-muted-foreground text-sm">
                {t('uploadingVideo')}
              </p>
            </div>
          ) : (
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-white/12 bg-white/[0.02] p-8 transition-colors hover:border-white/20">
              <Upload className="text-muted-foreground size-6" />
              <p className="text-muted-foreground text-sm">
                {t('clickToUploadMp4')}
              </p>
              <p className="text-muted-foreground text-xs">{t('mp4Hint')}</p>
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
            ) : (
              t('saveButton')
            )}
          </Button>
        </div>
      )}

      {/* Audio toggle */}
      <div className="mt-5 rounded-lg border border-white/8 bg-white/[0.02] p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            {muted ? (
              <VolumeX className="size-4 text-white/40" />
            ) : (
              <Volume2 className="size-4 text-emerald-400" />
            )}
            <span className="text-sm font-medium text-white">
              {t('audioLabel')}
            </span>
            <span className={`text-xs ${muted ? 'text-white/40' : 'text-emerald-400'}`}>
              {muted ? t('audioMuted') : t('audioOn')}
            </span>
          </div>
          <button
            type="button"
            onClick={handleToggleAudio}
            disabled={savingAudio}
            aria-label={muted ? t('audioOn') : t('audioMuted')}
            className={`relative h-6 w-11 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 disabled:opacity-50 ${
              muted ? 'bg-white/10' : 'bg-emerald-500'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform ${
                muted ? 'translate-x-0' : 'translate-x-5'
              }`}
            />
          </button>
        </div>
        {!muted && (
          <div className="mt-3 flex items-start gap-2 text-xs text-amber-400/80">
            <AlertTriangle className="mt-0.5 size-3 shrink-0" />
            <span>{t('autoplayWarning')}</span>
          </div>
        )}
      </div>
    </div>
  )
}
