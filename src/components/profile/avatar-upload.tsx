'use client'

import { useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Camera } from 'lucide-react'
import { toast } from 'sonner'
import { uploadAvatar } from '@/app/[locale]/(viewer)/profile/actions'

interface AvatarUploadProps {
  currentUrl: string | null
  fallbackInitial: string
}

export function AvatarUpload({ currentUrl, fallbackInitial }: AvatarUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const objectUrlRef = useRef<string | null>(null)
  const [preview, setPreview] = useState<string | null>(currentUrl)
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
      setPreview(result.avatarUrl)
      toast.success(t('avatarUpdated'))
    } catch (err) {
      setPreview(currentUrl)
      console.error('[avatar-upload] upload failed:', err instanceof Error ? err.message : err)
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
      className="group relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--line-2)] transition-all hover:border-[var(--text-mute)]"
      style={{ background: preview ? undefined : 'linear-gradient(135deg, rgba(96,115,255,0.85), rgba(46,57,121,0.92))' }}
    >
      {preview ? (
        <img src={preview} alt={t('avatarPicAlt')} className="size-full object-cover" />
      ) : (
        <span className="text-3xl font-semibold text-white">{fallbackInitial}</span>
      )}

      <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
        {uploading ? (
          <div className="size-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
        ) : (
          <Camera className="size-5 text-white" />
        )}
      </div>

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
