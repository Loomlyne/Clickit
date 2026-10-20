'use client'

import { useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Upload, Loader2, Trash2, Film } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  createPreloaderVideoUpload,
  removePreloaderVideo,
  savePreloaderVideoUpload,
} from '@/app/[locale]/admin/actions'
import { createClient as createBrowserSupabaseClient } from '@/lib/supabase/client'
import { resolveSupabaseVideoUrl } from '@/lib/supabase-media'

const DEFAULT_PRELOADER_SRC = '/brand/clickit-preloader.mp4'

export function PreloaderVideoField({
  currentUrl,
}: {
  currentUrl: string | null
}) {
  const t = useTranslations('admin.settings')
  const tHero = useTranslations('admin.heroMedia')
  const resolvedCurrentUrl = resolveSupabaseVideoUrl(currentUrl) ?? currentUrl
  const [url, setUrl] = useState<string | null>(resolvedCurrentUrl)
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const previewSrc = url ?? DEFAULT_PRELOADER_SRC

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 20 * 1024 * 1024) {
      toast.error(t('preloaderVideoTooLarge'))
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.warning(t('preloaderVideoSizeWarning'))
    }

    setBusy(true)
    try {
      const uploadTarget = await createPreloaderVideoUpload({
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
          { contentType: 'video/mp4', cacheControl: '31536000', upsert: true }
        )
      if (uploadError) {
        toast.error(uploadError.message)
        return
      }

      const result = await savePreloaderVideoUpload(uploadTarget.data.path)
      if (!result.success || !result.data) {
        toast.error(result.error ?? t('uploadFailed'))
        return
      }

      setUrl(resolveSupabaseVideoUrl(result.data) ?? result.data)
      toast.success(t('preloaderVideoUploaded'))
    } catch {
      toast.error(t('uploadFailed'))
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function onRemove() {
    setBusy(true)
    try {
      const result = await removePreloaderVideo()
      if (!result.success) {
        toast.error(result.error ?? t('removeFailed'))
        return
      }
      setUrl(null)
      toast.success(t('preloaderVideoRemoved'))
    } catch {
      toast.error(t('removeFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="relative mx-auto aspect-video w-full max-w-sm overflow-hidden rounded-lg border border-[var(--line)] bg-black">
        <video
          key={previewSrc}
          src={previewSrc}
          muted
          autoPlay
          loop
          playsInline
          className="h-full w-full object-contain"
        />
        {!url ? (
          <span className="absolute end-2 top-2 rounded-full bg-[var(--bg-3)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-dim)]">
            {t('preloaderVideoDefaultBadge')}
          </span>
        ) : null}
      </div>

      {url ? (
        <Button
          variant="destructive"
          size="sm"
          onClick={onRemove}
          disabled={busy}
        >
          <Trash2 className="me-2 size-4" />
          {tHero('removeButton')}
        </Button>
      ) : null}

      {busy ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--line-2)] bg-[var(--bg-2)] p-6">
          <Loader2 className="text-muted-foreground size-5 animate-spin" />
          <p className="text-muted-foreground text-xs">
            {tHero('uploadingVideo')}
          </p>
        </div>
      ) : (
        <label className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-[var(--line-2)] bg-[var(--bg-2)] p-6 transition-colors hover:border-[var(--line-2)]">
          <Upload className="text-muted-foreground size-5" />
          <p className="text-muted-foreground text-xs">
            {tHero('clickToUploadMp4')}
          </p>
          <p className="text-muted-foreground text-center text-[11px]">
            {t('preloaderVideoHint')}
          </p>
          <input
            ref={inputRef}
            type="file"
            accept="video/mp4"
            className="hidden"
            onChange={onFile}
          />
        </label>
      )}

      <div className="flex items-start gap-2 text-xs text-[var(--text-mute)]">
        <Film className="mt-0.5 size-3.5 shrink-0" />
        <p>{t('preloaderVideoNote')}</p>
      </div>
    </div>
  )
}
