'use client'

import { useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Camera } from 'lucide-react'
import { toast } from 'sonner'
import { uploadAvatar } from '@/app/[locale]/(viewer)/profile/actions'
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

  async function handleFile(file: File) {
    if (file.size > 2 * 1024 * 1024) {
      toast.error(t('avatarTooLarge'))
      return
    }

    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)

    const objectUrl = URL.createObjectURL(file)
    objectUrlRef.current = objectUrl
    setPreview(objectUrl)
    setUploading(true)

    try {
      const formData = new FormData()
      formData.append('avatar', file)
      const result = await uploadAvatar(formData)
      URL.revokeObjectURL(objectUrl)
      objectUrlRef.current = null
      setPreview(stripStorageCacheBust(result.avatarUrl) ?? result.avatarUrl)
      toast.success(t('avatarUpdated'))
    } catch (err) {
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
