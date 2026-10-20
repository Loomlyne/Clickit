'use client'

import { useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Camera } from 'lucide-react'
import { toast } from 'sonner'
import { finalizeAvatarUpload } from '@/app/[locale]/(viewer)/profile/actions'
import { uploadImageDirect } from '@/lib/browser-upload'
import { notifyUploadError, notifyUploaded } from '@/components/admin/upload-status'
import { stripStorageCacheBust } from '@/lib/supabase-media'

interface AvatarUploadProps {
  currentUrl: string | null
  fallbackInitial: string
}

export function AvatarUpload({
  currentUrl,
  fallbackInitial,
}: AvatarUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const objectUrlRef = useRef<string | null>(null)
  const resolvedCurrentUrl = stripStorageCacheBust(currentUrl) ?? currentUrl
  const [preview, setPreview] = useState<string | null>(resolvedCurrentUrl)
  const [uploading, setUploading] = useState(false)
  const t = useTranslations('profile')

  // Browser -> R2 directly (requestMediaUpload, PUT, finalize). The avatar is a small
  // round control with no zone, so the existing spinner stays and messages are toasts.
  async function handleFile(file: File) {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)

    const objectUrl = URL.createObjectURL(file)
    objectUrlRef.current = objectUrl
    setPreview(objectUrl)
    setUploading(true)

    const dropPreview = () => {
      URL.revokeObjectURL(objectUrl)
      if (objectUrlRef.current === objectUrl) objectUrlRef.current = null
    }

    try {
      const result = await uploadImageDirect({
        file,
        kind: 'avatar',
        finalize: ({ key, variantKeys }) => finalizeAvatarUpload({ key, variantKeys }),
      })
      if (!result.ok) {
        dropPreview()
        setPreview(resolvedCurrentUrl)
        notifyUploadError(result.error, {
          retry: () => void handleFile(file),
          tooLargeMessage: t('avatarTooLarge'),
        })
        return
      }
      dropPreview()
      setPreview(stripStorageCacheBust(result.url) ?? result.url)
      notifyUploaded({ message: t('avatarUpdated'), safariFallback: result.safariFallback })
    } catch (err) {
      dropPreview()
      setPreview(resolvedCurrentUrl)
      console.error(
        '[avatar-upload] upload failed:',
        err instanceof Error ? err.message : err
      )
      toast.error(t('avatarUploadFailed'))
    } finally {
      setUploading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      disabled={uploading}
      aria-label={t('changeAvatar')}
      className="group relative size-20 shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-0)]"
    >
      <span className="flex size-full items-center justify-center overflow-hidden rounded-full border border-[var(--line-2)] bg-[var(--uis-primary-soft)] transition-colors group-hover:border-[var(--text-mute)]">
        {preview ? (
          <img
            src={preview}
            alt={t('avatarPicAlt')}
            className="size-full object-cover"
          />
        ) : (
          <span className="text-3xl font-semibold text-[var(--primary)]">
            {fallbackInitial}
          </span>
        )}
      </span>

      {/* Permanent camera badge: touch screens have no hover. */}
      <span
        aria-hidden
        className="absolute -end-1 -bottom-1 flex size-8 items-center justify-center rounded-full border-2 border-[var(--bg-0)] bg-[var(--bg-3)] text-[var(--text)]"
      >
        {uploading ? (
          <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
        ) : (
          <Camera className="size-4" />
        )}
      </span>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
          e.target.value = ''
        }}
      />
    </button>
  )
}
