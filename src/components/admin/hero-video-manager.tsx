'use client'

import { useState, useRef } from 'react'
import { useTranslations } from 'next-intl'
import {
  Upload,
  Loader2,
  Trash2,
  Link as LinkIcon,
  Film,
  Volume2,
  VolumeX,
  Monitor,
  Smartphone,
} from 'lucide-react'
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
import { probeLocalMp4HasAudio } from '@/lib/media-audio'
import { resolveSupabaseVideoUrl } from '@/lib/supabase-media'

type VideoConfig = { url: string; type: 'mp4' | 'youtube' } | null
type HeroVariant = 'desktop' | 'mobile'

export function HeroVideoManager({
  desktopVideo,
  mobileVideo,
  heroVideoMuted,
}: {
  desktopVideo: VideoConfig
  mobileVideo: VideoConfig
  heroVideoMuted: boolean
}) {
  const t = useTranslations('admin.heroMedia')
  const [muted, setMuted] = useState(heroVideoMuted)
  const [savingAudio, setSavingAudio] = useState(false)

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

  return (
    <div>
      <div className="grid gap-5 lg:grid-cols-2">
        <HeroVariantPanel
          variant="desktop"
          label={t('desktopHero')}
          icon={<Monitor className="size-4 text-white/60" />}
          aspectClassName="aspect-video w-full"
          hint={t('desktopVideoHint')}
          current={desktopVideo}
          onMp4Saved={() => setMuted(false)}
        />
        <HeroVariantPanel
          variant="mobile"
          label={t('mobileHero')}
          icon={<Smartphone className="size-4 text-white/60" />}
          aspectClassName="mx-auto aspect-[9/16] w-full max-w-[200px]"
          hint={t('mobileVideoHint')}
          current={mobileVideo}
          onMp4Saved={() => setMuted(false)}
        />
      </div>

      {/* Shared audio toggle — applies to whichever variant is on screen */}
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
            <span
              className={`text-xs ${muted ? 'text-white/40' : 'text-emerald-400'}`}
            >
              {muted ? t('audioMuted') : t('audioOn')}
            </span>
          </div>
          <button
            type="button"
            onClick={handleToggleAudio}
            disabled={savingAudio}
            aria-label={muted ? t('audioOn') : t('audioMuted')}
            className={`relative h-6 w-11 rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:outline-none disabled:opacity-50 ${
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
      </div>
    </div>
  )
}

/**
 * One hero video slot (desktop OR mobile). Owns its own MP4-upload / YouTube-URL
 * mode toggle, preview, and remove — all scoped to the given `variant` so the
 * two slots never clobber each other's storage path or DB columns.
 */
function HeroVariantPanel({
  variant,
  label,
  icon,
  aspectClassName,
  hint,
  current,
  onMp4Saved,
}: {
  variant: HeroVariant
  label: string
  icon: React.ReactNode
  aspectClassName: string
  hint: string
  current: VideoConfig
  onMp4Saved?: () => void
}) {
  const t = useTranslations('admin.heroMedia')
  const [video, setVideo] = useState<VideoConfig>(current)
  const [mode, setMode] = useState<'mp4' | 'youtube'>(current?.type ?? 'mp4')
  const [busy, setBusy] = useState(false)
  const [youtubeInput, setYoutubeInput] = useState(
    current?.type === 'youtube' ? current.url : ''
  )
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 50 * 1024 * 1024) {
      toast.error(t('videoTooLarge'))
      return
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.warning(
        'Video is over 8 MB — large hero clips drive Supabase cached egress. Compress to ~2–5 MB (720p H.264) or use a YouTube URL instead.'
      )
    }

    const hasAudio = await probeLocalMp4HasAudio(file)
    if (!hasAudio) {
      toast.error(t('videoNoAudioTrack'))
      if (inputRef.current) inputRef.current.value = ''
      return
    }

    setBusy(true)
    try {
      const uploadTarget = await createHeroVideoUpload(
        { name: file.name, size: file.size, type: file.type },
        variant
      )
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
          { contentType: 'video/mp4', cacheControl: '31536000', upsert: true }
        )
      if (uploadError) {
        toast.error(uploadError.message)
        return
      }

      const result = await saveHeroVideoUpload(uploadTarget.data.path, variant)
      if (!result.success || !result.data) {
        toast.error(result.error ?? t('uploadFailed'))
        return
      }

      setVideo({ url: result.data, type: 'mp4' })
      onMp4Saved?.()
      toast.success(t('uploadVideoSuccess', { label }))
      toast.message(t('videoAudioEnabled'))
    } catch {
      toast.error(t('uploadFailed'))
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function handleYoutubeSave() {
    if (!youtubeInput.trim()) {
      toast.error(t('pasteYoutubePrompt'))
      return
    }
    if (!extractYouTubeId(youtubeInput)) {
      toast.error(t('invalidYoutube'))
      return
    }

    setBusy(true)
    try {
      const result = await setHeroVideoUrl(youtubeInput.trim(), variant)
      if (!result.success) {
        toast.error(result.error ?? t('saveFailed'))
        return
      }
      setVideo({ url: youtubeInput.trim(), type: 'youtube' })
      toast.success(t('youtubeSetSuccess', { label }))
    } catch {
      toast.error(t('saveFailed'))
    } finally {
      setBusy(false)
    }
  }

  async function handleRemove() {
    setBusy(true)
    try {
      const result = await removeHeroVideo(variant)
      if (!result.success) {
        toast.error(result.error ?? t('removeFailed'))
        return
      }
      setVideo(null)
      setYoutubeInput('')
      toast.success(t('removeSuccess', { label }))
    } catch {
      toast.error(t('removeFailed'))
    } finally {
      setBusy(false)
    }
  }

  const ytId = video?.type === 'youtube' ? extractYouTubeId(video.url) : null

  return (
    <div className="rounded-lg border border-white/8 bg-white/[0.02] p-4">
      <div className="mb-3 flex items-center gap-2">
        {icon}
        <span className="text-sm font-medium text-white">{label}</span>
      </div>

      {/* Current video preview */}
      {video && (
        <div className="mb-4 space-y-2">
          <div
            className={`relative overflow-hidden rounded-lg border border-white/8 bg-black ${aspectClassName}`}
          >
            {video.type === 'mp4' ? (
              <video
                src={resolveSupabaseVideoUrl(video.url) ?? video.url}
                muted
                autoPlay
                loop
                playsInline
                className="h-full w-full object-cover"
              />
            ) : ytId ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={getYouTubeThumbnailUrl(ytId)}
                alt={t('youtubeThumbnailAlt')}
                className="h-full w-full object-cover"
              />
            ) : null}
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleRemove}
            disabled={busy}
          >
            <Trash2 className="me-2 size-4" />
            {t('removeButton')}
          </Button>
        </div>
      )}

      {/* Mode toggle */}
      <div className="mb-3 flex gap-2">
        <button
          type="button"
          onClick={() => setMode('mp4')}
          className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
            mode === 'mp4'
              ? 'bg-white text-black'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Film className="size-3.5" />
          {t('uploadMp4')}
        </button>
        <button
          type="button"
          onClick={() => setMode('youtube')}
          className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
            mode === 'youtube'
              ? 'bg-white text-black'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <LinkIcon className="size-3.5" />
          {t('youtubeUrlLabel')}
        </button>
      </div>

      {/* MP4 upload */}
      {mode === 'mp4' &&
        (busy ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-white/12 bg-white/[0.02] p-6">
            <Loader2 className="text-muted-foreground size-5 animate-spin" />
            <p className="text-muted-foreground text-xs">
              {t('uploadingVideo')}
            </p>
          </div>
        ) : (
          <label className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-white/12 bg-white/[0.02] p-6 transition-colors hover:border-white/20">
            <Upload className="text-muted-foreground size-5" />
            <p className="text-muted-foreground text-xs">
              {t('clickToUploadMp4')}
            </p>
            <p className="text-muted-foreground text-center text-[11px]">
              {hint}
            </p>
            <input
              ref={inputRef}
              type="file"
              accept="video/mp4"
              className="hidden"
              onChange={handleFileUpload}
            />
          </label>
        ))}

      {/* YouTube URL input */}
      {mode === 'youtube' && (
        <div className="flex flex-col gap-2">
          <input
            type="url"
            placeholder="https://www.youtube.com/watch?v=..."
            value={youtubeInput}
            onChange={(e) => setYoutubeInput(e.target.value)}
            className="placeholder:text-muted-foreground w-full rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2 text-sm text-white focus:border-white/20 focus:outline-none"
          />
          <Button
            onClick={handleYoutubeSave}
            disabled={busy || !youtubeInput.trim()}
            size="sm"
            className="self-start"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : t('saveButton')}
          </Button>
        </div>
      )}
    </div>
  )
}
